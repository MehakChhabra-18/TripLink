/**
 * Cloudinary Utility Helpers
 * deleteOldImage — extract public_id from URL and destroy file on Cloudinary
 */
const cloudinary = require("../config/cloudinary");

/**
 * Extract Cloudinary public_id from a full URL.
 *
 * Example URL:
 *   https://res.cloudinary.com/myapp/image/upload/v1234567/triplink/profile-images/abc123.jpg
 * Extracted public_id:
 *   triplink/profile-images/abc123
 *
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null}  public_id or null if URL is invalid
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    // Match everything after "/upload/v<version>/" and strip the extension
    const match = url.match(/\/upload\/v\d+\/(.+)\.[a-z]+$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Delete an old file from Cloudinary if a valid URL is given.
 * Silently ignores errors so a failed delete never breaks the upload flow.
 *
 * @param {string|null} oldUrl  - Existing Cloudinary URL stored in DB
 * @param {string} resourceType - "image" (default) or "raw" (for PDFs)
 */
const deleteFromCloudinary = async (oldUrl, resourceType = "image") => {
  const publicId = extractPublicId(oldUrl);
  if (!publicId) return; // nothing to delete

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // Log but never throw — upload should still succeed even if delete fails
    console.warn(`[Cloudinary] Could not delete old file (${publicId}):`, err.message);
  }
};

module.exports = { deleteFromCloudinary, extractPublicId };
