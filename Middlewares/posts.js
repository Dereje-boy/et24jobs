function post1(req,res,next) {
    console.log("visiting post 1");   
    next()
}

function post2(req, res, next) {
    console.log("visiting post 2");
    res.send('you have reached the ending')
}

module.exports.post1  = post1;
module.exports.post2  = post2;