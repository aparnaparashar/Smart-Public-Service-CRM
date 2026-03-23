const { GoogleGenerativeAI } = require('@google/generative-ai');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const nodemailer = require('nodemailer');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ FIX 1: Use the correct model initialisation with a system instruction
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `
You are **JanMitra**, the official AI assistant for the Smart Public Service CRM (PS-CRM) system used by citizens of Delhi.

Your role is to guide citizens in using the grievance redressal platform effectively.

ABOUT PS-CRM
PS-CRM is a centralized digital command center that:
• receives citizen complaints
• assigns them to government departments
• tracks complaint progress
• ensures transparency and accountability

YOUR CAPABILITIES
1. Complaint Tracking — Ask for CRM number in format CMP-XXXXXXX (7 digits)
2. Government Scheme Eligibility — Delhi Government welfare schemes
3. Ward & Municipal Services — garbage, sanitation, electricity, water, roads
4. Human Officer Connection — forward request, officer responds in 24 hours

RESPONSE STYLE: polite, clear, professional, concise, structured.

RULES:
• Do not invent policies or guess complaint status
• If unsure, advise contacting the relevant department
• Always respond in the same language the citizen uses (Hindi or English)
  `.trim(),
});

/* ------------------------------------------
   Welcome Message
-------------------------------------------*/
const welcomeMessage = `
👋 Namaste! I am JanMitra, your Smart Public Service Assistant for the PS-CRM platform.

I can help you with the following services:

1️⃣ Track a Complaint  
   Share your CRM number in the format: **CMP-XXXXXXX**

2️⃣ Check Eligibility for Delhi Government Schemes  
   Ask about any Delhi government welfare scheme.

3️⃣ Ward & Municipal Services  
   Ask questions about sanitation, water supply, electricity, road repair and other municipal services.

4️⃣ Connect to a Human Officer  
   If you need personal assistance, I can connect you with a government officer.  
   They will contact you via email or phone within 24 hours.

How may I assist you today?
`.trim();


/* ------------------------------------------
   Main Chatbot Controller
-------------------------------------------*/
const chatWithBot = async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || message.trim().toLowerCase() === 'start') {
      return res.json({ response: welcomeMessage });
    }

    const lowerMessage = message.toLowerCase();

    /* ------------------------------------------
       Intent Detection
    -------------------------------------------*/

    // Complaint tracking: detect CRM number or tracking intent
    if (
      lowerMessage.includes('track') ||
      lowerMessage.includes('status') ||
      /cmp-\d/i.test(message)
    ) {
      return handleTrackComplaint(message, res);
    }

    if (lowerMessage.includes('scheme') || lowerMessage.includes('eligibility')) {
      return handleEligibilityCheck(message, res);
    }

    if (
      lowerMessage.includes('ward') ||
      lowerMessage.includes('municipal') ||
      lowerMessage.includes('garbage') ||
      lowerMessage.includes('water') ||
      lowerMessage.includes('electricity') ||
      lowerMessage.includes('road') ||
      lowerMessage.includes('sanitation')
    ) {
      return handleWardServices(message, res);
    }

    // ✅ FIX 3: Guard userId BEFORE calling handleConnectToOfficer
    if (
      lowerMessage.includes('officer') ||
      lowerMessage.includes('human') ||
      lowerMessage.includes('connect') ||
      lowerMessage.includes('speak')
    ) {
      if (!userId) {
        return res.json({
          response: 'Please log in to connect with a government officer.',
        });
      }
      return handleConnectToOfficer(userId, message, res);
    }

    /* ------------------------------------------
       Generic Gemini Fallback
    -------------------------------------------*/

    // ✅ FIX 1: Use only generateContent — generateText does not exist in this SDK
    let aiResponse;
    try {
      const result = await model.generateContent(message);

      // ✅ FIX 2: Safe null-check before calling .text()
      aiResponse = result?.response?.text?.() ?? '';
    } catch (aiError) {
      console.error('Gemini API error:', aiError);
      aiResponse = '';
    }

    if (!aiResponse.trim()) {
      aiResponse =
        'I could not generate a response right now. Please try again soon.';
    }

    return res.json({ response: aiResponse });

  } catch (error) {
    console.error('JanMitra chatbot error:', error);
    res.status(500).json({
      response:
        "Sorry, I'm having trouble responding right now. Please try again later.",
    });
  }
};


/* ------------------------------------------
   Track Complaint
-------------------------------------------*/
const handleTrackComplaint = async (message, res) => {

  // ✅ FIX 4: Enforce exactly 7 digits to match CMP-XXXXXXX format
  const crmRegex = /CMP-\d{7}/i;
  const match = message.match(crmRegex);

  if (!match) {
    return res.json({
      response:
        'Please provide your CRM number in the format **CMP-XXXXXXX** (7 digits) so I can track your complaint.',
    });
  }

  const crmNumber = match[0].toUpperCase();

  try {
    const complaint = await Complaint.findOne({ complaintNumber: crmNumber });

    if (!complaint) {
      return res.json({
        response: `No complaint found with CRM number **${crmNumber}**. Please verify the number and try again.`,
      });
    }

    const submittedOn = complaint.createdAt
      ? new Date(complaint.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : 'N/A';

    const response = `
📄 *Complaint Details*

• **CRM Number:** ${crmNumber}
• **Title:** ${complaint.title}
• **Category:** ${complaint.category}
• **Urgency:** ${complaint.urgency}
• **Current Status:** ${complaint.status}
• **Submitted On:** ${submittedOn}

If you have further questions, feel free to ask!
    `.trim();

    return res.json({ response });

  } catch (error) {
    console.error('Complaint tracking error:', error);
    return res.json({
      response: 'Sorry, there was an issue retrieving your complaint status. Please try again.',
    });
  }
};


/* ------------------------------------------
   Government Scheme Eligibility
-------------------------------------------*/
const handleEligibilityCheck = async (message, res) => {
  const prompt = `
The citizen is asking about a Delhi Government scheme. Provide clear eligibility criteria:

"${message}"

Include:
• Who is eligible
• Income / age / residency requirements
• Required documents

Keep it simple and factual. Remind citizens to verify on official Delhi Government websites (delhi.gov.in).
  `.trim();

  try {
    const result = await model.generateContent(prompt);

    // ✅ FIX 2: Safe access
    const response = result?.response?.text?.() ?? 'Sorry, I could not retrieve scheme information right now.';
    return res.json({ response });

  } catch (error) {
    console.error('Eligibility check error:', error);
    return res.json({
      response: 'Sorry, I couldn\'t retrieve scheme eligibility information right now.',
    });
  }
};


/* ------------------------------------------
   Ward Services
-------------------------------------------*/
const handleWardServices = async (message, res) => {
  const prompt = `
A Delhi citizen is asking about a municipal / ward service. Answer helpfully and accurately:

"${message}"

Cover topics like garbage collection, water supply, electricity complaints, road maintenance, or ward office details as relevant. Provide practical guidance.
  `.trim();

  try {
    const result = await model.generateContent(prompt);

    // ✅ FIX 2: Safe access
    const response = result?.response?.text?.() ?? 'Sorry, I could not retrieve ward service information right now.';
    return res.json({ response });

  } catch (error) {
    console.error('Ward services error:', error);
    return res.json({
      response: 'Sorry, I couldn\'t retrieve ward service information right now.',
    });
  }
};


/* ------------------------------------------
   Connect to Human Officer
-------------------------------------------*/
const handleConnectToOfficer = async (userId, message, res) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        response: 'Please log in to connect with a government officer.',
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'gov.grievance.system@gmail.com',
      subject: `[PS-CRM] Citizen Assistance Request — ${user.name}`,
      text: `
Citizen Name:  ${user.name}
Citizen Email: ${user.email}

Message from citizen:
${message}

Please contact the citizen within 24 hours via email or phone.
      `.trim(),
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      response:
        '✅ Your request has been forwarded to a human officer. They will contact you via email or phone within **24 hours**.',
    });

  } catch (error) {
    console.error('Officer connection error:', error);
    return res.json({
      response: 'Sorry, there was a problem forwarding your request. Please try again.',
    });
  }
};


/* ------------------------------------------
   Export
-------------------------------------------*/
module.exports = { chatWithBot };