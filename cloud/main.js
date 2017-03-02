var Clarifai = require('clarifai');

var app = new Clarifai.App(
    'hHUyyW6_ahQ4Lc3yNoSrcVqKX_d2B1izffyWVo49',
    'fCkpzb6ddxnr1Q7h6KwHhTNWp7IYUkff_Kf5g__B'
    );




//MARK: cloud hooks for New Cube. Input: cubeID, centralHubID
Parse.Cloud.define("newCube", function(req,res){
  var cubeQuery = new Parse.Query("Cube")
  cubeQuery.equalTo("objectId", req.params.cubeID)
  cubeQuery.find({
    success: function(cubes){
      if(cubes.length > 0) {
        var cube = cubes[0]
        if (cube.get("centralHub") != null) {
          //cube found, but already has pointer to central hub
          console.log("cube in use")
          res.success("in use")
        }  else {
          var centralHubPointer = {__type: 'Pointer', className: 'CentralHub', objectId: req.params.centralHubID}
          cube.set("centralHub", centralHubPointer)
          cube.save(null, {
            success:function(success){
              res.success(cube.get("macAddress"))
            },
            error: function(error) {
              res.success("error")
            }
          }) 
        }
      } else {
        console.log("no cubes found cubeID" + req.params.cubeID)
        res.success("error")
      }
    },
    error: function(error){
      console.log("error fiding cubes for cubeID")
      res.success("error")
    }
  })
})

//MARK: cloud hooks for New Sensor Data. Input: cubeID, temperature, battery, humidity
Parse.Cloud.define("newSensorData", function(req,res){
    var sensorDataSubclass = Parse.Object.extend("SensorData");
    var sensorData = new sensorDataSubclass();
    sensorData.set("humidity",req.params.humidity)
    sensorData.set("temperature",req.params.temperature)
    sensorData.set("battery",req.params.battery)
    var cubePointer = {__type: 'Pointer', className: 'Cube', objectId: req.params.cubeID}
    sensorData.set("cube",cubePointer)
    sensorData.save(null, {
      success:function(success){
        res.success("saved")
      },
      error: function(error) {
        res.success("error")
      }
    })
})



// Parse.Cloud.beforeSave("CentralHubData", function(req, res) {
//     var newData = req.object;
//     if (!newData.existed()) {
//       var query = new Parse.Query("CentralHubData")
//       var centralHubPointer = {__type: 'Pointer', className: 'CentralHub', objectId: newData.get("centralHub").id}
//       query.equalTo("centralHub", centralHubPointer)
//       query.find({
//         success: function(centralHubDatas) {
//             if(centralHubDatas.length > 0){
//                 centralHubData = centralHubDatas[0]
//                 centralHubData.set("battery", newData.get("battery"))
//                 centralHubData.set("photoFile", newData.get("photoFile"))
//                 centralHubData.save(null, {
//                 success:function(success){
//                   res.error("updated older data")
//                 },
//                 error: function(error) {
//                   res.error("error")
//                 }
//               })
//             } else {
//               //no previouse centralHubData - success to save
//               console.log(newData.id)
//               res.success("save")              
//             }
//           },
//           error: function(error) {
//             console.log("error");
//             res.error("error")
//           }
//       })
//     }
//});



//MARK: cloud hooks for fetch sensor cubes for a specific central hub. Input: centralHubID, deivceType 
Parse.Cloud.define("fetchCubes", function(req,res){
  var query = new Parse.Query("Cube")
  query.equalTo("deviceType", req.params.deviceType) //(1 = camera cube, 2 = sensor cube)

  //Pointer to the Central Hub
  var centralHubPointer = {__type: 'Pointer', className: 'CentralHub', objectId: req.params.centralHubID}
  query.equalTo("centralHub", centralHubPointer);

  CubesMACAddresses = [];

  query.find({
    success:function(foundCubes){
      for(var i =0; i < foundCubes.length; i++) {
          var macAddress = foundCubes[i].get("macAddress");
          CubesMACAddresses.push(macAddress)
      }
      res.success(CubesMACAddresses)
    }, 
    error: function(error) {
      console.log("erroring fetching sensor cubes for hub " + req.params.centralHubId)
      res.success(CubesMACAddresses);
    }
  })
})

/**
** @brief: search for a food item in FoodItem database
** If item does not exist, create one
**/
Parse.Cloud.define("searchInFoodItem", function(req, res) {
  var query = new Parse.Query("FoodItem");

  var ids_detected = [];
  var idsWithNames = {}; // mapping between id->name of food
  var idsWithProbabilities = {}; // mapping between id->probability of correctness (used for userFood class)

  for(var i =0; i<req.params.APIresponse.length; i++) {
    ids_detected.push(req.params.APIresponse[i]["id"]);
    idsWithNames[req.params.APIresponse[i]["id"]] = req.params.APIresponse[i]["name"];
    idsWithProbabilities[req.params.APIresponse[i]["id"]] = req.params.APIresponse[i]["value"];
  }

  console.log("IDs found by API: " + ids_detected.length);

  /*** (1): Searching for all ids that the Food API detected inside our FoodItem collection ***/
  query.containedIn("clarifaiID", ids_detected);
  query.find({
    success: function(foodItemsFound){ // foodItemsFound: contains IDs of all of the IDs that were detected and are inside the database

      /*** (2): Removing all IDs that have been detected inside database from our ids_detected array ***/
      for(var i=0; i<foodItemsFound.length; i++) {
        var elemToRemove = foodItemsFound[i].get("clarifaiID");
        var indexToRemove = ids_detected.indexOf(elemToRemove);

        if(indexToRemove > -1)
          ids_detected.splice(indexToRemove,1);
      }

      /* At this point, all elements inside ids_detected should be elements that needs to be added to the FoodItems collection */
      console.log("Number of IDs not in DB: " + ids_detected.length);
      /*** (3): Adding all new IDs to the database ***/
      var objectsToSave = [];
      var foodItemSubclass = Parse.Object.extend("FoodItem");
      
      for(var i=0; i<ids_detected.length; i++) {
        var foodItem = new foodItemSubclass();
        foodItem.set("clarifaiID", ids_detected[i]);
        foodItem.set("foodName", idsWithNames[ids_detected[i]]);
        objectsToSave.push(foodItem);
      }

      /*** (4): Submitting query to save ***/
      Parse.Object.saveAll(objectsToSave, {
        useMasterKey: true,
        success: function(succ) {
          console.log("Successfully saved " + objectsToSave.length + " IDs");
          res.success("done");
        },
        error: function(error) {
          console.log("error while saving to DB");
          console.log(error);
          res.error(error);
        }
      });

    },
    error: function(error){
      console.log(error);
      res.error(error);
    }


  });

});

Parse.Cloud.define("saveToUsersFoodItem", function(req, res) {
  var query = new Parse.Query("FoodItem");

  var userID = req.params.userID;
  var ids_detected = []; // stores all of the IDs that have been detected by API
  var idsWithProbabilities = {}; // mapping between id->probability of correctness (used for userFood class)

  for(var i =0; i<req.params.APIresponse.length; i++) {
    ids_detected.push(req.params.APIresponse[i]["id"]);
    idsWithProbabilities[req.params.APIresponse[i]["id"]] = req.params.APIresponse[i]["value"];
  }

  /*** (1): Searching for all ids that the Food API detected inside our FoodItem collection ***/
  query.containedIn("clarifaiID", ids_detected);
  query.find({
    success: function(foodItemsFound) {

      if(foodItemsFound.length == req.params.APIresponse.length) {
        console.log("All Items were added to the FoodItems Collection :)");
      }
      else {
        console.log("Some items are missing in the FoodItems Collection - this should not happen :(");
      }

      var objectsToSave = [];
      var userFoodItemSubclass = Parse.Object.extend("UserFoodItem");
      for(var i=0; i<foodItemsFound.length; i++) {
        var userFoodItem = new userFoodItemSubclass();
        var userPointer = {__type: 'Pointer', className: '_User', objectId: userID}
        var foodItemPointer = {__type: 'Pointer', className: 'FoodItem', objectId: foodItemsFound[i].id} // NOT SURE
        var proba = idsWithProbabilities[foodItemsFound[i].get("clarifaiID")];

        userFoodItem.set("foodItem", foodItemPointer);
        userFoodItem.set("user", userPointer);
        userFoodItem.set("probability", proba); // TODO
        objectsToSave.push(userFoodItem);
      }

      Parse.Object.saveAll(objectsToSave, {
        useMasterKey: true,
        success: function(succ) {
          console.log("Successfully saved " + objectsToSave.length + " IDs");
          res.success("done");
        },
        error: function(error) {
          console.log("error while saving to DB");
          console.log(error);
          res.error(error);
        }
      });
    },
    error: function(error) {
      console.log(error);
      res.error(error);
    }
  });

});

//MARK: afterSave and beforeSave Functions 

Parse.Cloud.afterSave("SensorData", function(req, res) {
    var sensorDataObject = req.object;
    if (!sensorDataObject.existed()) {
      var cubeQuery = new Parse.Query("Cube")
      cubeQuery.equalTo("objectId", sensorDataObject.get("cube").id)
      cubeQuery.find({
        success: function(cubes) {
            if(cubes.length > 0){
                var cube = cubes[0]
                var sensorDataPointer = {__type: 'Pointer', className: 'SensorData', objectId: sensorDataObject.id}
                sensorDataArray = cube.get("sensorData")
                if(sensorDataArray == null) {
                  sensorDataArray = [sensorDataPointer]
                } else {
                  sensorDataArray.unshift(sensorDataPointer)
                }

                //Only keep the most recent 15 SensorData linked to Cube (still keep them in the SensorData Collection)
                if(sensorDataArray.length > 15) {
                  sensorDataArray.splice(15, sensorDataArray.length - 14)
                }

                cube.set("sensorData", sensorDataArray)
                cube.save()
            } else {
              console.log("no Cube  object found")
            }
          },
          error: function(error) {
            console.log("error finding cube");
          }
       })
  }
    res.success("success")
});

Parse.Cloud.beforeSave("CentralHubData", function(req, res) {

	var photoObject = req.object;

  //if(!photoObject.existed()) {

    var imageURL = photoObject.get("photoFile").url;
    var centralHub = photoObject.get("centralHub");

    var queryToGetUserID = new Parse.Query("CentralHub");
    queryToGetUserID.equalTo("objectId", photoObject.get("centralHub").id);

    console.log("Predicting...");
    console.log("Image URL: " + imageURL);
    app.models.predict(Clarifai.FOOD_MODEL, imageURL).then(
        function(response) {
            console.log("Found something!");
            //console.log(response.outputs[0]["data"].concepts); // printing all of the detected ingredients from image
            Parse.Cloud.run('searchInFoodItem', {"APIresponse": response.outputs[0]["data"].concepts}, {
              useMasterKey: true,
              success: function(res) {
                console.log("successfully called searchInFoodItem method");

                queryToGetUserID.find({
                  success: function(centralHubObj) {
                    console.log("Successfully found Central Hub object from pointer");
                    Parse.Cloud.run('saveToUsersFoodItem', {"APIresponse": response.outputs[0]["data"].concepts, "userID": centralHubObj[0].get("user").id}, {
                    useMasterKey: true,
                    success: function(res) {
                      console.log("Successfully called method saveToUsersFoodItem");
                    }, 
                    error: function(err) {
                      console.log("Error while calling function saveToUsersFoodItem");
                    }
                });

                  },
                  error: function(err) {
                    console.log("Error - Cannot find Central Hub from pointer");
                  }
                });

              },
              error: function(err) {
                console.log("err: Parse.Cloud.run");
              }
            });

        },
        function(err) {
          // there was an error
          console.log("Error :(");
          console.log(err);
        }
      );
  //}

	res.success(); // save image in DB
});