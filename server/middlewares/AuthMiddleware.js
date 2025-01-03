import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.cookies.jwt; // JWT token from cookies

  if (!token) {
    return res.status(400).send("No token provided");
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(400).send("Invalid token");
    }

    req.userId = decoded.id; // Attach userId from decoded token
    next(); // Move to the next middleware/route handler
  });
};
