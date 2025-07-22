
const Router = require("koa-router");
const router = new Router();


//* These are the controllers for routing, set and left as an example
//* You can change the names and paths as per your requirements
//* The controllers should be defined in the controllers directory

const { examplePostController } = require("./controllers/example_post_controller");
const { exampleGetController } = require('./controllers/example_get_controller');

router.post("/postexample", examplePostController);
router.get("/getexample", exampleGetController);

module.exports = router;
