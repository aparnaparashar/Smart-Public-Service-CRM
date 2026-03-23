const Complaint = require('../models/Complaint');

const getDashboardStats = async (req, res) => {
  try {
    // Total complaints
    const total      = await Complaint.countDocuments();
    const pending    = await Complaint.countDocuments({ status: 'Pending' });
    const inProgress = await Complaint.countDocuments({ status: 'In Progress' });
    const resolved   = await Complaint.countDocuments({ status: 'Resolved' });

    // Complaints by category
    const byCategory = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Complaints by urgency
    const byUrgency = await Complaint.aggregate([
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Complaints by ward
    const byWard = await Complaint.aggregate([
      { $match: { 'location.ward': { $exists: true, $ne: null } } },
      { $group: { _id: '$location.ward', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Recent complaints (last 5)
    const recentComplaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title category urgency status createdAt citizen.name');

    // Complaints per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTrend = await Complaint.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: { total, pending, inProgress, resolved },
        byCategory,
        byUrgency,
        byWard,
        recentComplaints,
        dailyTrend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public stats - no auth required
const getPublicStats = async (req, res) => {
  try {
    const total      = await Complaint.countDocuments();
    const pending    = await Complaint.countDocuments({ status: 'Pending' });
    const resolved   = await Complaint.countDocuments({ status: 'Resolved' });
    const inProgress = await Complaint.countDocuments({ status: 'In Progress' });

    // By category
    const byCategory = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // By ward — only complaints that have a ward set
    const byWard = await Complaint.aggregate([
      { $match: { 'location.ward': { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$location.ward', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Daily trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTrend = await Complaint.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: { total, pending, resolved, inProgress, byCategory, byWard, dailyTrend },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats, getPublicStats };