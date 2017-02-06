var Clarifai = require('clarifai');

var app = new Clarifai.App(
    'hHUyyW6_ahQ4Lc3yNoSrcVqKX_d2B1izffyWVo49',
    'fCkpzb6ddxnr1Q7h6KwHhTNWp7IYUkff_Kf5g__B'
    );


Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


// Parse.Cloud.beforeSave(<CLASSNAME>, function(req, res) {

// });

Parse.Cloud.beforeSave("Photo", function(req, res) {
	var photoObject = req.object;
	var imageString = photoObject.get("encryptString");
	console.log("got base64 image: " + imageString);

	console.log("Predicting...");
	app.models.predict(Clarifai.FOOD_MODEL, "http://orgjunkie.com/wp-content/uploads/2010/09/fridge4.jpg").then(
    	function(response) {
      		console.log("Found something!");
      		console.log(response.outputs[0]["data"].concepts); // printing all of the detected ingredients from image
    	},
    	function(err) {
    		// there was an error
    		console.log("Error :(");
    		console.log(err);
    	}
  	);

	res.success(); // save image in DB
});