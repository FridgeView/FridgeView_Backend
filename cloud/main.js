var Clarifai = require('clarifai');

var app = new Clarifai.App(
    'hHUyyW6_ahQ4Lc3yNoSrcVqKX_d2B1izffyWVo49',
    'fCkpzb6ddxnr1Q7h6KwHhTNWp7IYUkff_Kf5g__B'
    );



/* 
    MARK: Functions used directly by the CentralHub
*/

//MARK: Cloud hooks for New Cube. Input: cubeID, centralHubID
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

/* 
    MARK: afterSave and beforeSave Functions 
*/

//Update the pointer array to add the newest Sensor to the SensorCube
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

//Update the pointer to the newest CameraData to the CameraCube
Parse.Cloud.afterSave("CameraData", function(req, res) {
    var cameraDataObject = req.object;
    if (!cameraDataObject.existed()) {
      var cubeQuery = new Parse.Query("Cube")
      cubeQuery.equalTo("objectId", cameraDataObject.get("cube").id)
      cubeQuery.find({
        success: function(cubes) {
            if(cubes.length > 0){
                var cube = cubes[0]
                var cameraDataPointer = {__type: 'Pointer', className: 'CameraData', objectId: cameraDataObject.id}
                cube.set("cameraData", cameraDataPointer) //Add new photo to cube object, not deleting old photo yet 
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
})

//Update the pointer to the newest CentralHubData to the CentralHub
Parse.Cloud.afterSave("CentralHubData", function(req, res) {
    var centralHubDataObject = req.object;
    if (!centralHubDataObject.existed()) {
      var centralHubQuery = new Parse.Query("CentralHub")
      centralHubQuery.equalTo("objectId", centralHubDataObject.get("centralHub").id)
      centralHubQuery.find({
        success: function(centralHubs) {
            if(centralHubs.length > 0){
                var centralHub = centralHubs[0]
                var centralHubPointer = {__type: 'Pointer', className: 'CentralHubData', objectId: centralHubDataObject.id}
                centralHub.set("centralHubData", centralHubPointer) //Add new photo to cube object, not deleting old photo yet 
                centralHub.save()
            } else {
              console.log("no hub  object found")
            }
          },
          error: function(error) {
            console.log("error finding cube");
          }
       })
  }
    res.success("success")
})

// Used for begin step of image processing 
Parse.Cloud.beforeSave("CentralHubData", function(req, res) {

	var photoObject = req.object;

  if(!photoObject.existed()) {

    var imageURL = photoObject.get("photoFile").url();
    var centralHub = photoObject.get("centralHub");

    var queryToGetUserID = new Parse.Query("CentralHub");
    queryToGetUserID.equalTo("objectId", photoObject.get("centralHub").id);

    console.log("Predicting...");
    app.models.predict(Clarifai.FOOD_MODEL, imageURL).then(
        function(response) {
            console.log("Found something!");
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
  }

	res.success(); // save image in DB
});


/* 
    MARK: ClarifAI Functions 
*/
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
          console.log("Successfully saved " + objectsToSave.length + " IDs to FoodItem");
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
  var queryFoodItem = new Parse.Query("FoodItem");
  var queryUserID = new Parse.Query("UserFoodItem");

  var userID = req.params.userID;
  var userPointer = {__type: 'Pointer', className: '_User', objectId: userID}

  var ids_detected = []; // stores all of the IDs that have been detected by API
  var idsWithProbabilities = {}; // mapping between id->probability of correctness (used for userFood class)

  for(var i =0; i<req.params.APIresponse.length; i++) {
    ids_detected.push(req.params.APIresponse[i]["id"]);
    idsWithProbabilities[req.params.APIresponse[i]["id"]] = req.params.APIresponse[i]["value"];
  }

  /*** (1): Searching for all ids that the Food API detected inside our FoodItem collection ***/
  queryFoodItem.containedIn("clarifaiID", ids_detected);
  queryFoodItem.find({
    success: function(foodItemsFound) {

      if(foodItemsFound.length == req.params.APIresponse.length) {
        console.log("All Items were added to the FoodItems Collection :)");
      }
      else {
        console.log("Some items are missing in the FoodItems Collection - this should not happen :(");
      }

      queryUserID.equalTo("user", userPointer);
      queryUserID.include("foodItem");
      queryUserID.find({
        success: function(previousUserInventory) {

          var objectsToSave = [];
          var objectsToDestroy = [];

          for(var i=0; i<previousUserInventory.length; i++) {
            var foundInNewArray = false;

            /*** searching for the element inside the new array ***/
            for(var j=0; j<foodItemsFound.length; j++) {
              /** element from previous is in the new resuts **/
              if(previousUserInventory[i].get("foodItem").get("clarifaiID") == foodItemsFound[j].get('clarifaiID')) {
                foundInNewArray = true;
                if(previousUserInventory[i].get("status") == -1) {
                  previousUserInventory[i].set("status", 0);
                  objectsToSave.push(previousUserInventory[i]);
                }
                // delete this element from the new array
                foodItemsFound.splice(j,1);
              }
            }
            /** element from previous is not in new resuts **/
            if(!foundInNewArray) {

              if(previousUserInventory[i].get("status") == 0) {
                previousUserInventory[i].set("status", -1);
                objectsToSave.push(previousUserInventory[i]);
              }
              else if(previousUserInventory[i].get("status") == 1)
                objectsToDestroy.push(previousUserInventory[i]);
              else if(previousUserInventory[i].get("status") == -1)
                objectsToSave.push(previousUserInventory[i]);
            }
            else // if we found the element in the loop above (just change the variable back to false)
              foundInNewArray = false;
          }


          var userFoodItemSubclass = Parse.Object.extend("UserFoodItem");
          for(var i=0; i<foodItemsFound.length; i++) {
            var userFoodItem = new userFoodItemSubclass();
            var foodItemPointer = {__type: 'Pointer', className: 'FoodItem', objectId: foodItemsFound[i].id} // NOT SURE
            var proba = idsWithProbabilities[foodItemsFound[i].get("clarifaiID")];

            userFoodItem.set("foodItem", foodItemPointer);
            userFoodItem.set("user", userPointer);
            userFoodItem.set("status", 1);
            userFoodItem.set("probability", proba*100); // TODO
            objectsToSave.push(userFoodItem);
          }

          Parse.Object.saveAll(objectsToSave, {
            useMasterKey: true,
            success: function(succ) {
              console.log("Successfully saved " + objectsToSave.length + " IDs to UserFoodItem");
              if(objectsToDestroy.length != 0) {
                console.log("Attempting to destroy " + objectsToDestroy.length + " objects");
                Parse.Object.destroyAll(objectsToDestroy, {
                  useMasterKey: true,
                  success: function(succ) {
                    console.log("Successfully destroyed " + objectsToDestroy.length + " IDs");
                    res.success(succ);
                  },
                  error: function(error) {
                    console.log("error while destroying from DB");
                    res.error(error);
                  }
                });
              }
              else {
                console.log("Not deleting anything");
                res.success(succ);
              }
            },
            error: function(error) {
              console.log("error while saving to DB");
              console.log(error);
              res.error(error);
            }
          });

        },
        error: function(err) {
          console.log("Error while retreiving previous user's inventory");
          console.log(err);
          res.error(err);
        }

      });
    },
    error: function(error) {
      console.log(error);
      res.error(error);
    }
  });

});


Parse.Cloud.define("changeItemsToStatus0", function(req, res) {
  var query = new Parse.Query("UserFoodItem");

  query.containedIn("objectId", req.params.items);
  query.find({
    success: function(objectsToModif) {
      for(var i=0; i<objectsToModif.length; i++) {
        objectsToModif[i].set("status", 0);
      }
      Parse.Object.saveAll(objectsToModif, {
        useMasterKey: true,
        success: function(succ) {
          console.log("Successfully changed " + objectsToModif.length + " objects in UserFoodItem");
          res.success(succ);
        },
        error: function(err) {
          console.log("Error while saving to DB");
        }
      });

    },
    error: function(error) {
      console.log("Error while querying DB");
      res.error(error);
    }
  });
});

Parse.Cloud.define("deleteItems", function(req, res) {
  var query = new Parse.Query("UserFoodItem");

  query.containedIn("objectId", req.params.items);
  query.find({
    success: function(objectsToRemove) {
      Parse.Object.destroyAll(objectsToRemove, {
        useMasterKey: true,
        success: function(succ) {
          console.log("Successfully deleted " + objectsToRemove.length + " objects in UserFoodItem");
          res.success(succ);
        },
        error: function(err) {
          console.log("Error while destroying");
          res.error(err);
        }
      });
    },
    error: function(error) {
      console.log("Error while querying");
      res.error(error);
    }
  });
});

Parse.Cloud.define("addUserItem", function(req, res) {
  var query = new Parse.Query("FoodItem");

  var userFoodItemSubclass = Parse.Object.extend("UserFoodItem");

  //TODO: santatize user input (i.e. lower case only)

  query.equalTo("foodName", req.params.item);
  query.find({
    success: function(objectFound) {
      var objectsToSave = [];
      if(objectFound.length == 0) {
        console.log("Object with name " + req.params.item + " was not found in FoodItem");

        // create dummy entry in FoodItem
        var foodItemSubclass = Parse.Object.extend("FoodItem");
        var newFoodItem = new foodItemSubclass();

        newFoodItem.set("clarifaiID", "DUMMY");
        newFoodItem.set("foodName", req.params.item);
        var addObj = [];
        addObj.push(newFoodItem);
        Parse.Object.saveAll(addObj, {
          useMasterKey: true,
          success: function(succ) {
            console.log("Successfully created DUMMY entry in FoodItem");
            // create new entry in UserFoodItem
            var newUserFoodItem = new userFoodItemSubclass();
            var foodItemPtr = {__type: 'Pointer', className: 'FoodItem', objectId: newFoodItem.id}
            var userPointer = {__type: 'Pointer', className: '_User', objectId: req.params.userID}
            console.log("OK FOR POINTER DECS");
            newUserFoodItem.set("probability", 100);
            newUserFoodItem.set("status", 0);
            newUserFoodItem.set("user", userPointer);
            newUserFoodItem.set("foodItem", foodItemPtr);
            objectsToSave.push(newUserFoodItem);
            console.log("ABOUT TO SAVE!! OMG!!!");
            Parse.Object.saveAll(objectsToSave, {
              useMasterKey: true,
              success: function(success) {
                console.log("Successfully saved new item to UserFoodItem");
                res.success(success);
              },
              error: function(error) {
                console.log("Error while saving to UserFoodItem through DUMMY");
                res.error(error);
              }
            });
          },
          error: function(err) {
            console.log("Error while creating DUMMY entry in FoodItem");
            res.error(err);
          }
        });
      }
      else { // if an object was found

        console.log("Found item in FoodItem");
        var newUserFoodItem = new userFoodItemSubclass();
        var foodItemPtr = {__type: 'Pointer', className: 'FoodItem', objectId: objectFound[0].id}
        var userPointer = {__type: 'Pointer', className: '_User', objectId: req.params.userID}
        

        newUserFoodItem.set("probability", 100);
        newUserFoodItem.set("status", 0);
        newUserFoodItem.set("user", userPointer);
        newUserFoodItem.set("foodItem", foodItemPtr);
        objectsToSave.push(newUserFoodItem);
        Parse.Object.saveAll(objectsToSave, {
          useMasterKey: true,
          success: function(success) {
            console.log("Successfully saved new item to UserFoodItem");
            res.success(success);
          },
          error: function(error) {
            console.log("Error while saving to UserFoodItem through DUMMY");
            res.error(error);
          }
        });
      }
    },
    error: function(err) {

      console.log("Erorr while querying FoodItem to search for name");
      res.error(err);
    }
  });
});

Parse.Cloud.define("addPtrToCentralHub", function(req, res) {
  var objectsToSave = []
  var query = new Parse.Query("User");
  query.equalTo("objectId", req.params.userId);
  query.find({
    success: function(userFound) {
      if(userFound.length != 1) {
        console.log("WARNING: multiple/no user found for given ID!! This should not happen");
      }

      var centralHubPtr = {__type: 'Pointer', className: 'CentralHub', objectId: req.params.centralHubId}
      userFound[0].set("defaultCentralHub", centralHubPtr);
      objectsToSave.push(userFound[0])

      var centralHubQuery = new Parse.Query("CentralHub")
      centralHubQuery.equalTo("objectId", req.params.centralHubId)
      centralHubQuery.find({
        success:function(centralHubs) {
          var centralHub = centralHubs[0]

          var userPtr = {__type: 'Pointer', className: '_User', objectId: req.params.userId}
          centralHub.set("user", userPtr);
          objectsToSave.push(centralHub)

          Parse.Object.saveAll(objectsToSave, {
          useMasterKey: true,
          success: function(succ) {
            console.log("Successfully saved Item in User Collection")
            res.success(succ);
          },
          error: function(err) {
            console.log("Error while saving to User Collection");
            res.error(err);
          }
        });
        }, 
        error:function(error) {
          console.log("error querying for centralHub")
          res.error(error)
        }

      }) 

     
    },
    error: function(err) {
      console.log("Error while querying the User Collection")
      res.error(err);
    }
  });
});