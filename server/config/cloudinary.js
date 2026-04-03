const cloudinary = require('cloudinary').v2;

let initialized = false;

const parseCloudinaryUrlCredentials = () => {
    const raw = process.env.CLOUDINARY_URL || '';
    if (!raw) return null;

    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'cloudinary:') return null;

        const cloudName = decodeURIComponent(parsed.hostname || parsed.pathname.replace(/^\/+/, ''));
        const apiKey = decodeURIComponent(parsed.username || '');
        const apiSecret = decodeURIComponent(parsed.password || '');

        if (!cloudName || !apiKey || !apiSecret) return null;

        return {
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true
        };
    } catch {
        return null;
    }
};

const hasNamedCredentials = () => {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME
        && process.env.CLOUDINARY_API_KEY
        && process.env.CLOUDINARY_API_SECRET
    );
};

const hasUrlCredential = () => Boolean(parseCloudinaryUrlCredentials());

const isCloudinaryConfigured = () => hasNamedCredentials() || hasUrlCredential();

const ensureCloudinaryConfigured = () => {
    if (initialized || !isCloudinaryConfigured()) return;

    if (hasNamedCredentials()) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
    } else {
        const fromUrl = parseCloudinaryUrlCredentials();
        if (!fromUrl) return;
        cloudinary.config(fromUrl);
    }

    initialized = true;
};

const uploadImageFromPath = async (filePath, options = {}) => {
    ensureCloudinaryConfigured();
    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured.');
    }

    return cloudinary.uploader.upload(filePath, {
        resource_type: 'image',
        folder: 'jobfinder/uploads',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        ...options
    });
};

module.exports = {
    isCloudinaryConfigured,
    uploadImageFromPath
};
