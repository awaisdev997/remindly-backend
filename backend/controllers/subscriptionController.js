import Subscription from '../models/Subscription.js';

// Helper to normalize subscription cost to monthly outflow
const normalizeToMonthly = (amount, billingCycle = 'monthly') => {
  const num = Number(amount) || 0;
  switch (billingCycle) {
    case 'daily':
      return num * 30;
    case 'weekly':
      return (num * 52) / 12;
    case 'yearly':
      return num / 12;
    case 'monthly':
    default:
      return num;
  }
};

// Whitelist of allowed client-updatable fields (prevents mass-assignment)
const ALLOWED_FIELDS = ['name', 'category', 'startDate', 'expiryDate', 'amount', 'billingCycle', 'notes'];

export const getSubscriptions = async (req, res, next) => {
  try {
    const { statusFilter, category } = req.query;
    const query = { user: req.user.id };

    // Direct database predicate for category
    if (category && category !== 'All') {
      query.category = category;
    }

    // Direct database predicates for status using date ranges (utilizes index)
    const now = new Date();
    if (statusFilter === 'active') {
      query.expiryDate = { $gte: now };
    } else if (statusFilter === 'expired') {
      query.expiryDate = { $lt: now };
    } else if (statusFilter === 'upcoming') {
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.expiryDate = { $gte: now, $lte: sevenDaysLater };
    }

    const subscriptions = await Subscription.find(query).sort({ expiryDate: 1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionById = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (req, res, next) => {
  try {
    const { name, category, startDate, expiryDate, amount, billingCycle, notes } = req.body;

    // Explicit field picking prevents mass assignment
    const subscription = await Subscription.create({
      user: req.user.id,
      name,
      category,
      startDate: startDate || Date.now(),
      expiryDate,
      amount,
      billingCycle: billingCycle || 'monthly',
      notes,
    });

    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

export const updateSubscription = async (req, res, next) => {
  try {
    // Pick only whitelisted fields
    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Atomic update scoped strictly to current user's document
    const subscription = await Subscription.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id });

    let activeCount = 0;
    let expiredCount = 0;
    let upcomingCount = 0;
    let totalMonthlyOutflow = 0;
    let upcomingList = [];

    subscriptions.forEach(sub => {
      const info = sub.statusInfo;
      if (info.status === 'Expired') {
        expiredCount += 1;
      } else {
        activeCount += 1;
        // Accurate billing cycle calculation instead of naive raw amount summation
        totalMonthlyOutflow += normalizeToMonthly(sub.amount, sub.billingCycle);

        if (info.status === 'Expiring Soon') {
          upcomingCount += 1;
          upcomingList.push(sub);
        }
      }
    });

    upcomingList.sort((a, b) => a.statusInfo.daysLeft - b.statusInfo.daysLeft);

    res.status(200).json({
      success: true,
      data: {
        totalActive: activeCount,
        totalExpired: expiredCount,
        upcomingRenewals: upcomingCount,
        totalMonthlyOutflow: Number(totalMonthlyOutflow.toFixed(2)),
        upcomingList,
      },
    });
  } catch (error) {
    next(error);
  }
};
