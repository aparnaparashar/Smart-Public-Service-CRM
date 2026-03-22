const Complaint = require('../models/Complaint');
const { setSLADeadline } = require('../config/slaService');
const { sendComplaintConfirmation, sendStatusUpdate } = require('../config/emailService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const parseImages = (rawImages) => {
  if (!rawImages) return [];
  const arr = typeof rawImages === 'string' ? JSON.parse(rawImages) : rawImages;
  if (!Array.isArray(arr)) return [];
  return arr.map(img => ({
    data:       img.data       || '',
    name:       img.name       || 'image',
    type:       img.type       || 'image/jpeg',
    uploadedAt: new Date(),
  }));
};

const VALID_DEPARTMENTS = [
  'Sanitation & Solid Waste Management',
  'Roads & Infrastructure',
  'Water Supply & Drainage',
  'Street Lighting',
  'Health Services',
  'Education (MCD Schools)',
  'Building & Planning',
  'Parks & Horticulture',
  'Property Tax',
  'Birth & Death Registration',
  'Food Safety & Slaughterhouse',
  'Fire Services',
  'Veterinary Services',
  'Encroachment Removal',
  'Advertisement & Signage',
  'Other',
];

const VALID_CATEGORIES = [
  'Sanitation', 'Roads', 'Water', 'Electricity', 'Health',
  'Education', 'Infrastructure', 'Environment', 'Finance',
  'Administration', 'Food Safety', 'Safety', 'Animal Welfare',
  'Encroachment', 'Signage', 'Other',
];

const VALID_URGENCIES = ['High', 'Medium', 'Low'];

const CLASSIFICATION_PROMPT = (title, description) => `You are an expert AI classifier for a Delhi Municipal Corporation (MCD) public grievance portal in India.

A citizen has submitted this complaint:
Title: "${title}"
Description: "${description}"

Your job is to classify this complaint accurately into the correct MCD department.

DEPARTMENTS AND THEIR EXACT ISSUES:
1.  "Sanitation & Solid Waste Management"  → garbage not collected, overflowing dustbin, waste dumping, sweeping not done, dirty road, foul smell, open garbage, littering
2.  "Roads & Infrastructure"               → pothole, road damage, broken road, road cave-in, speed breaker needed, road construction, divider broken (NOT footpath blocking by vendors)
3.  "Water Supply & Drainage"              → no water supply, water pipeline leak, drain overflow, sewage problem, waterlogging, borewell issue, tap water issue, water cut
4.  "Street Lighting"                      → streetlight not working, dark road at night, broken light pole, street lamp broken, no lighting on road
5.  "Health Services"                      → MCD dispensary issue, mosquito breeding, dengue, malaria, vector control, public health camp, vaccination, disease outbreak
6.  "Education (MCD Schools)"              → MCD school complaint, teacher absent, mid-day meal problem, school building issue, student admission MCD school
7.  "Building & Planning"                  → illegal construction, unauthorized building, demolition notice, building permit complaint, construction without permission
8.  "Parks & Horticulture"                 → park not maintained, broken bench in park, overgrown grass, fallen tree, garden dirty, horticulture complaint
9.  "Property Tax"                         → wrong property tax bill, tax assessment error, property tax rebate, tax billing complaint, duplicate tax notice
10. "Birth & Death Registration"           → birth certificate not issued, death certificate delay, certificate correction, registration problem at MCD office
11. "Food Safety & Slaughterhouse"         → adulterated food, expired food sold, unhygienic food shop, meat shop complaint, food poisoning complaint, slaughterhouse issue
12. "Fire Services"                        → fire incident, fire hazard, fire safety violation, fire NOC complaint, fire extinguisher missing, burning
13. "Veterinary Services"                  → stray dog attack, dog bite, stray animals, animal cruelty, animal vaccination, cattle on road
14. "Encroachment Removal"                 → illegal encroachment on footpath, vendor blocking footpath, illegal stall on road, hawker occupying public space, roadside encroachment
15. "Advertisement & Signage"             → illegal hoarding, unauthorized banner, illegal signage, advertisement violation, hoarding blocking view
16. "Other"                                → complaints that do not match any above department

CATEGORY must be one of: Sanitation, Roads, Water, Electricity, Health, Education, Infrastructure, Environment, Finance, Administration, Food Safety, Safety, Animal Welfare, Encroachment, Signage, Other

URGENCY rules:
- High   → immediate danger to life, health emergency, accident risk, crime, fire, no water/electricity for many days
- Medium → ongoing inconvenience, affects daily life, not life-threatening
- Low    → minor issue, cosmetic problem, information request, suggestion

IMPORTANT RULES:
- "footpath blocked by vendor/hawker" = Encroachment Removal (NOT Roads)
- "streetlight not working" = Street Lighting (NOT Electricity)
- "stray dog" = Veterinary Services (NOT Safety)
- "illegal construction" = Building & Planning (NOT Encroachment)
- "park dirty" = Parks & Horticulture (NOT Sanitation)
- Always match the department EXACTLY as written above

Return ONLY a raw JSON object. No markdown. No explanation. No extra text:
{"category":"Encroachment","urgency":"Medium","department":"Encroachment Removal","reason":"Vendor illegally occupying public footpath"}`;

// POST /api/complaints
const submitComplaint = async (req, res) => {
  try {
    const { urgency, images, ...rest } = req.body;
    const deadline = setSLADeadline(urgency || 'Low');
    const complaint = await Complaint.create({
      ...rest, urgency,
      images: parseImages(images),
      sla: { deadline, escalated: false, escalatedAt: null },
    });
    const savedComplaint = await Complaint.findById(complaint._id);
    sendComplaintConfirmation(savedComplaint);
    res.status(201).json({ success: true, data: savedComplaint });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/complaints
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/track/:complaintNumber
const getComplaintByNumber = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      complaintNumber: req.params.complaintNumber.toUpperCase(),
    });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/:id
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/complaints/:id
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, resolution, assignedTo, afterImages } = req.body;
    const updateFields = {
      ...(status                   && { status }),
      ...(resolution               && { resolution }),
      ...(assignedTo !== undefined && { assignedTo }),
    };
    const parsedAfterImages = parseImages(afterImages);
    if (parsedAfterImages.length > 0) updateFields.afterImages = parsedAfterImages;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const populatedComplaint = await Complaint.findById(complaint._id).lean();
    if (populatedComplaint.assignedTo) {
      const User = require('../models/User');
      const officer = await User.findById(populatedComplaint.assignedTo).select('name');
      populatedComplaint.assignedOfficerName = officer?.name || 'Field Officer';
    }
    sendStatusUpdate(populatedComplaint);
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/my
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ 'citizen.email': req.user.email }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/assigned
const getAssignedComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ assignedTo: req.user._id.toString() }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Parse and validate AI response ──────────────────────────────────────────
const parseAIResponse = (raw) => {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const catMatch  = cleaned.match(/"category"\s*:\s*"([^"]+)"/);
    const urgMatch  = cleaned.match(/"urgency"\s*:\s*"([^"]+)"/);
    const deptMatch = cleaned.match(/"department"\s*:\s*"([^"]+)"/);
    const resMatch  = cleaned.match(/"reason"\s*:\s*"([^"]+)"/);
    parsed = {
      category:   catMatch?.[1]  || 'Other',
      urgency:    urgMatch?.[1]  || 'Low',
      department: deptMatch?.[1] || 'Other',
      reason:     resMatch?.[1]  || 'AI classified',
    };
  }
  const finalCategory   = VALID_CATEGORIES.includes(parsed.category)   ? parsed.category   : 'Other';
  const finalUrgency    = VALID_URGENCIES.includes(parsed.urgency)      ? parsed.urgency    : 'Low';
  const finalDepartment = VALID_DEPARTMENTS.includes(parsed.department) ? parsed.department : 'Other';
  return { category: finalCategory, urgency: finalUrgency, department: finalDepartment, reason: parsed.reason || 'AI classified' };
};

// POST /api/complaints/classify
const classifyComplaint = async (req, res) => {
  const { title = '', description = '' } = req.body;

  if (!title && !description) {
    return res.status(400).json({ success: false, message: 'Title or description required' });
  }

  const prompt = CLASSIFICATION_PROMPT(title, description);

  // ── PRIMARY: Groq (Llama 3.3 70B) ────────────────────────────────────────
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,  // low temperature = more consistent output
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content || '';
    const result = parseAIResponse(raw);

    console.log(`[Groq] "${title}" → ${result.category} / ${result.urgency} / ${result.department}`);
    return res.status(200).json({ success: true, data: result });

  } catch (groqError) {
    console.error('[Groq] Error:', groqError.message, '— Falling back to Gemini...');

    // ── FALLBACK: Gemini 2.0 Flash ──────────────────────────────────────────
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const geminiResult = await model.generateContent(prompt);
      const raw = geminiResult.response.text();
      const result = parseAIResponse(raw);

      console.log(`[Gemini] "${title}" → ${result.category} / ${result.urgency} / ${result.department}`);
      return res.status(200).json({ success: true, data: result });

    } catch (geminiError) {
      console.error('[Gemini] Error:', geminiError.message, '— Both AI failed.');

      // ── LAST RESORT: return Other ───────────────────────────────────────
      return res.status(200).json({
        success: true,
        data: {
          category:   'Other',
          urgency:    'Low',
          department: 'Other',
          reason:     'AI unavailable. Please select department manually.',
        }
      });
    }
  }
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  getComplaintByNumber,
  getComplaintById,
  updateComplaintStatus,
  getMyComplaints,
  getAssignedComplaints,
  classifyComplaint,
};