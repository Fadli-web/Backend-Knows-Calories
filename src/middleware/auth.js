import { supabase, createUserClient } from '../config/supabase.js';

/**
 * Middleware to authenticate requests using Supabase JWT Bearer token.
 * Attaches req.user, req.token, and req.supabase (RLS compliant) to the request.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization token is required (Format: Bearer <token>)'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired authentication token'
      });
    }

    // Attach to request
    req.user = user;
    req.token = token;
    req.supabase = createUserClient(token);

    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to authenticate user'
    });
  }
};

/**
 * Optional authentication middleware: if a token exists, attaches req.user;
 * otherwise allows the request to continue unauthenticated.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        req.user = user;
        req.token = token;
        req.supabase = createUserClient(token);
      }
    }
    next();
  } catch (err) {
    // Non-blocking for optional auth
    next();
  }
};
