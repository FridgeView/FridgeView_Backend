var Clarifai = require('clarifai');

var app = new Clarifai.App(
    'hHUyyW6_ahQ4Lc3yNoSrcVqKX_d2B1izffyWVo49',
    'fCkpzb6ddxnr1Q7h6KwHhTNWp7IYUkff_Kf5g__B'
    );


/**
** @brief: search for a food item in FoodItem database
** If item does not exist, create one
**/
Parse.Cloud.define('searchInFoodItem', function(req, res) {
  var query = new Parse.Query("FoodItem");

  var ids_detected = [];
  var idsWithNames = {}; // mapping between id->name of food
  var idsWithProbabilities = {}; // mapping between id->probability of correctness (used for userFood class)

  for(var i =0; i<req.params.length; i++) {
    ids_detected.push(req.params[i]["id"]);
    idswithNames[req.params[i]["id"]] = req.params[i]["name"];
    idswithNames[req.params[i]["id"]] = req.params[i]["value"];
  }

  /*** (1): Searching for all ids that the Food API detected inside our FoodItem collection ***/
  query.containedIn("id", ids_detected);
  query.findObject({
    success: function(foodItemsFound){ // foodItemsFound: contains IDs of all of the IDs that were detected and are inside the database

      /*** (2): Removing all IDs that have been detected inside database from our ids_detected array ***/
      for(var i=0; i<foodItemsFound.length; i++) {
        var elemToRemove = foodItemsFound[i].get("id");
        var indexToRemove = ids_detected.indexOf(elemToRemove);

        if(indexToRemove > -1)
          ids_detected.splice(indexToRemove,1);
      }

      /* At this point, all elements inside ids_detected should be elements that needs to be added to the FoodItems collection */
      
      /*** (3): Adding all new IDs to the database ***/
      var objectsToSave = [];
      for(var i=0; i<ids_detected; i++) {
        var foodItemSubclass = Parse.Object.extend("FoodItem");
        var foodItem = new foodItemSubclass();

        FoodItem.set("id", ids_detected[i]);
        foodItem.set("name", idswithNames[ids_detected[i]]);
        objectsToSave.push(foodItem);
      }

      /*** (4): Submitting query to save ***/
      Parse.Object.saveAll(objectsToSave, {
        success: function(res) {
          console.log("Successfully saved new IDs");
        },
        error: function(error) {
          console.log("err");
        }
      });

    },
    error: function(error){
      console.log("error")
    }


  });

});

Parse.Cloud.beforeSave("Photos", function(req, res) {

	var photoObject = req.object;

  if(!photoObject.existed()) {

    var imageString = photoObject.get("encrypStr");
    imageString.replace(/\r?\n|\r/g, "");

    console.log("Predicting...");
    app.models.predict(Clarifai.FOOD_MODEL, {base64: imageString}).then(
        function(response) {
            console.log("Found something!");
            //console.log(response.outputs[0]["data"].concepts); // printing all of the detected ingredients from image
            Parse.Cloud.Run('searchInFoodItem', {"APIresponse": response.outputs[0].concepts});

        },
        function(err) {
          // there was an error
          console.log("Error :(");
          console.log(err);
        }
      );
  }

	res.success(); // save image in DB
});