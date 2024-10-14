// The asyncHandler function is a wrapper for asynchronous route handlers in Express.js. It simplifies error handling by automatically catching any Promise rejections or errors from asynchronous operations, preventing the need for try...catch blocks inside route handlers. The error is passed to Express's next() function, which allows the built-in error-handling middleware to handle it.

const asyncHandler = (requestHandler) => {
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };

// Alternate way of doing above functionality
/*


const asyncHandler = (fn) => async (req,res,next) => {
    try{
        await fn(req,res,next);
    }
    catch(err){
        res.status(err.code || 500).json({
        success : false,
        message : err.message})
    }
   
} 

*/
