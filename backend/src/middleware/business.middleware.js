const businessMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Business access is only available to Admin",
    });
  }

  if (!req.user.businessId) {
    return res.status(403).json({
      success: false,
      message: "Business is not assigned to this account",
    });
  }

  req.businessId = req.user.businessId;

  next();
};

export default businessMiddleware;