import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../utils/AppError'; // adjust path if AppError lives elsewhere
import User from '../models/User';

/**
 * @desc    Get the authenticated user's profile
 * @route   GET /api/users/me
 * @access  Private
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select('-__v');

  if (!user || !user.isActive) {
    throw AppError.NotFound('User not found');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Update the authenticated user's profile
 *          (name, location, calculation method, madhab, notification prefs)
 * @route   PATCH /api/users/me
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const allowedFields = [
    'name',
    'location',
    'calculationMethod',
    'madhab',
    'highLatitudeRule',
    'notificationPreferences',
    'timezone',
  ] as const;

  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.BadRequest('No valid fields provided to update');
  }

  const user = await User.findOneAndUpdate(
    { _id: req.userId, isActive: true },
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-__v');

  if (!user) {
    throw AppError.NotFound('User not found');
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

/**
 * @desc    Update user's location (used to recalculate prayer times)
 * @route   PATCH /api/users/me/location
 * @access  Private
 */
export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, city, country } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw AppError.BadRequest('Latitude and longitude are required');
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw AppError.BadRequest('Invalid latitude or longitude values');
  }

  const user = await User.findOneAndUpdate(
    { _id: req.userId, isActive: true },
    {
      $set: {
        location: {
          latitude,
          longitude,
          city: city ?? undefined,
          country: country ?? undefined,
        },
      },
    },
    { new: true, runValidators: true }
  ).select('-__v');

  if (!user) {
    throw AppError.NotFound('User not found');
  }

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: user,
  });
});


/**
 * @desc    Register or update an FCM token for the current device
 * @route   POST /api/users/me/fcm-token
 * @access  Private
 */
export const addFcmToken = asyncHandler(async (req: Request, res: Response) => {
  const { token, deviceId, platform } = req.body;

  if (!token || !deviceId || !platform) {
    throw AppError.BadRequest('token, deviceId, and platform are required');
  }

  if (!['ios', 'android'].includes(platform)) {
    throw AppError.BadRequest('platform must be either "ios" or "android"');
  }

  const user = await User.findOne({ _id: req.userId, isActive: true });

  if (!user) {
    throw AppError.NotFound('User not found');
  }

  // Remove any existing entry for this device, then push the fresh token.
  // Keeps the array free of stale duplicates when a device's token rotates.
  user.fcmTokens = user.fcmTokens.filter((t: any) => t.deviceId !== deviceId);
  user.fcmTokens.push({ token, deviceId, platform, updatedAt: new Date() });

  await user.save();

  res.status(200).json({
    success: true,
    message: 'FCM token registered',
    data: { fcmTokens: user.fcmTokens },
  });
});