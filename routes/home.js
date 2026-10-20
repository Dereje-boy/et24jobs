const homeController = require("../controllers/homecontroller.js");
const Router = require("express").Router();

Router.get("/", homeController.home);
