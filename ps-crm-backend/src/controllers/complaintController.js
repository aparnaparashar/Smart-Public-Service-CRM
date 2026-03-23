const Complaint = require('../models/Complaint');
const { setSLADeadline } = require('../config/slaService');
const { sendComplaintConfirmation, sendStatusUpdate } = require('../config/emailService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

// POST /api/complaints
const submitComplaint = async (req, res) => {
  try {
    const { urgency, images, ...rest } = req.body;
    const deadline = setSLADeadline(urgency || 'Low');

    const complaint = await Complaint.create({
      ...rest,
      urgency,
      images: parseImages(images),
      sla: { deadline, escalated: false, escalatedAt: null },
    });

    // Refetch so post-save hook has populated complaintNumber
    const savedComplaint = await Complaint.findById(complaint._id);
    sendComplaintConfirmation(savedComplaint);

    res.status(201).json({ success: true, data: savedComplaint });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/complaints — All complaints (admin only)
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/track/:complaintNumber — Public track by CMP-XXXXXXXX
const getComplaintByNumber = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      complaintNumber: req.params.complaintNumber.toUpperCase(),
    });
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/:id — Single complaint by MongoDB _id
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
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
    if (parsedAfterImages.length > 0) {
      updateFields.afterImages = parsedAfterImages;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

   // Populate officer name for email
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
    const complaints = await Complaint.find({ 'citizen.email': req.user.email })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/complaints/assigned
const getAssignedComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ assignedTo: req.user._id.toString() })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/complaints/classify
const classifyComplaint = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({ success: false, message: 'Title or description required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a government complaint classification system for India.
Classify this public complaint into exactly one category from: Roads, Water, Electricity, Sanitation, Other.
Also determine urgency: High, Medium, or Low.
Also provide the responsible department from: PWD Department, Jal Board, Electricity Board, Municipal Corp, General Dept.

Complaint Title: "${title || ''}"
Complaint Description: "${description || ''}"

Rules:
- Roads: potholes, road damage, footpath, bridge, pavement issues
- Water: water supply, pipe leaks, drainage, flooding, tap water issues
- Electricity: streetlights, power cuts, electrical wires, transformer issues
- Sanitation: garbage, waste collection, sewage, drain blockage, cleanliness
- Other: anything that doesn't fit above

Respond ONLY with valid JSON, no markdown, no extra text:
{"category":"Roads","urgency":"High","department":"PWD Department","reason":"One line explanation"}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    const validCategories = ['Roads', 'Water', 'Electricity', 'Sanitation', 'Other'];
    const validUrgencies  = ['High', 'Medium', 'Low'];
    const validDepts      = ['PWD Department', 'Jal Board', 'Electricity Board', 'Municipal Corp', 'General Dept'];

    res.status(200).json({
      success: true,
      data: {
        category:   validCategories.includes(parsed.category)   ? parsed.category   : 'Other',
        urgency:    validUrgencies.includes(parsed.urgency)     ? parsed.urgency    : 'Low',
        department: validDepts.includes(parsed.department)      ? parsed.department : 'General Dept',
        reason:     parsed.reason || 'Classified by AI',
      }
    });

  } catch (error) {
    console.error('Gemini classification error:', error.message);
    const text = `${req.body.title || ''} ${req.body.description || ''}`.toLowerCase();
    let category = 'Other', urgency = 'Low', department = 'General Dept', reason = 'Keyword-based classification';

    if (['pothole','road','footpath','bridge','pavement','highway','street','tar'].some(k => text.includes(k))) {
      category = 'Roads'; urgency = 'High'; department = 'PWD Department'; reason = 'Road or infrastructure issue detected';
    } else if (['water','pipe','supply','leak','flood','drainage','tap','borewell'].some(k => text.includes(k))) {
      category = 'Water'; urgency = 'High'; department = 'Jal Board'; reason = 'Water supply or drainage issue detected';
    } else if (['light','electricity','power','wire','transformer','electric','bulb','streetlight'].some(k => text.includes(k))) {
      category = 'Electricity'; urgency = 'Medium'; department = 'Electricity Board'; reason = 'Electricity or lighting issue detected';
    } else if (['garbage','waste','sanitation','trash','smell','sewage','drain','dustbin','litter'].some(k => text.includes(k))) {
      category = 'Sanitation'; urgency = 'High'; department = 'Municipal Corp'; reason = 'Sanitation or waste issue detected';
    }

    res.status(200).json({ success: true, data: { category, urgency, department, reason } });
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