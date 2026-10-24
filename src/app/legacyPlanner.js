import { decodeSetup, encodeSetup } from '../sharing/legacyCodec.js';
import { createShareUrl, readSetupParameter } from '../sharing/shareUrl.js';
import { objectToRecord } from '../sharing/sceneRecords.js';
import { products, textures as textureDictionary, deskOffsets as deskHeightDiff } from '../catalog/products.js';
const THREE = window.THREE;
function validate(evt) {
    var theEvent = evt || window.event;

    // Handle paste
    if (theEvent.type === 'paste') {
        key = event.clipboardData.getData('text/plain');
    } else {
        // Handle key press
        var key = theEvent.keyCode || theEvent.which;
        key = String.fromCharCode(key);
    }
    var regex = /[0-9]|\./;
    if (!regex.test(key)) {
        theEvent.returnValue = false;
        if (theEvent.preventDefault) theEvent.preventDefault();
    }
}

var rightSideContainer = document.getElementById("rightSideContainer");
//small16x9Monitor Checkbox
document.getElementById('small16x9MonitorStand').onclick = function () {
    var checkBox = document.getElementById('small16x9MonitorStand');
    if (checkBox.value == "off") {
        checkBox.value = "on";
    } else {
        checkBox.value = "off";
    }
}

//largeCurved16x9Monitor Checkbox
document.getElementById('largeCurved16x9MonitorStand').onclick = function () {
    var checkBox = document.getElementById('largeCurved16x9MonitorStand');
    if (checkBox.value == "off") {
        checkBox.value = "on";
    } else {
        checkBox.value = "off";
    }
}

//flat21x9Monitor Checkbox
document.getElementById('flat21x9MonitorStand').onclick = function () {
    var checkBox = document.getElementById('flat21x9MonitorStand');
    if (checkBox.value == "off") {
        checkBox.value = "on";
    } else {
        checkBox.value = "off";
    }
}

//curved21x9Monitor Checkbox
document.getElementById('curved21x9MonitorStand').onclick = function () {
    var checkBox = document.getElementById('curved21x9MonitorStand');
    if (checkBox.value == "off") {
        checkBox.value = "on";
    } else {
        checkBox.value = "off";
    }
}

//curved32x9Monitor Checkbox
document.getElementById('curved32x9MonitorStand').onclick = function () {
    var checkBox = document.getElementById('curved32x9MonitorStand');
    if (checkBox.value == "off") {
        checkBox.value = "on";
    } else {
        checkBox.value = "off";
    }
}

document.getElementById('saveModalButton').onclick = function () {
    var customLink = createCustomLink();
    document.getElementById("customLinkForm").value = customLink;
}

//using the DOM to switch out the images
//60% keyboard on change
document.getElementById('default60PercentKeyboardForm').onchange = function () {
    var keyboardForm = document.getElementById('default60PercentKeyboardForm');
    var imageElement = document.getElementById('default60PercentKeyboardImage');
    imageElement.src = "Model thumbnails/" + "default60PercentKeyboard" + keyboardForm.value + ".jpg"
}

document.getElementById('75PercentKeyboardForm').onchange = function () {
    var keyboardForm = document.getElementById('75PercentKeyboardForm');
    var imageElement = document.getElementById('75PercentKeyboardImage');
    imageElement.src = "Model thumbnails/" + "75PercentKeyboard" + keyboardForm.value + ".jpg"
}

document.getElementById('defaultFullKeyboardForm').onchange = function () {
    var keyboardForm = document.getElementById('defaultFullKeyboardForm');
    var imageElement = document.getElementById('defaultFullKeyboardImage');
    imageElement.src = "Model thumbnails/" + "defaultFullKeyboard" + keyboardForm.value + ".jpg";
}

document.getElementById('TKLKeyboardForm').onchange = function () {
    var keyboardForm = document.getElementById('TKLKeyboardForm');
    var imageElement = document.getElementById('TKLKeyboardImage');
    imageElement.src = "Model thumbnails/" + "TKLKeyboard" + keyboardForm.value + ".jpg";
}

document.getElementById('customDeskForm').onchange = function () {
    var form = document.getElementById('customDeskForm');
    var imageElement = document.getElementById('customDeskImage');
    imageElement.src = form.options[form.selectedIndex].getAttribute("data-image");
}

//I believe this exists to allow the html to call unselectPickedObject in the pickHelper class
function unselectObjectCall() {
    pickHelper.unselectPickedObject();
}


























// PICK CLASS



//Class to help select JS objects
class PickHelper {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.pickedObject = null;
        this.pickedObjectSavedColor = 0;
        this.pickEnabled = true;
    }
    unselectPickedObject() {
        this.pickedObject = null;
        transformControls.detach();
    }
    setPickedObject(inputtedObject) {
        this.pickedObject = inputtedObject;
        //transformControls.detach();
        //transformControls.attach(inputtedObject);
    }

    deletePicked() {
        if (this.pickedObject != null && this.pickEnabled) {
            transformControls.detach();

            scene.remove(this.pickedObject);

            let remIndex = -1;
            for (let i = 0; i < objectsArr.length; i++) {
                if (objectsArr[i].name == this.pickedObject.name) {
                    remIndex = i;
                    i = objectsArr.length;
                }
            }

            if (remIndex != -1) {
                objectsArr = removeArrElem(objectsArr, remIndex);
            }

            this.pickedObject = null;

            console.log("objectsArr");
            console.log(objectsArr);
        }
        return objectsArr;
    }

    mouseSelect(normalizedPosition) {
        // restore the color if there is a picked object
        console.log("POSITION = " + normalizedPosition);
        console.log("PICKED CALLED");

        // cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);

        // find objects intersected by cast ray
        const intersectedObjects = this.raycaster.intersectObjects(objectsArr, true);

        // find first intersected object
        let index = intersectedObjects.length - 1;
        let interObj;

        console.log("INTERSECTED OBJECTS ARRAY");
        console.log(intersectedObjects)
        while (0 <= index) {
            console.log("WE MADE IT THIS FAR");
            interObj = intersectedObjects[index].object.parent;

            // prevents selection of objects we don't want to select
            if (!interObj.userData.type.includes("NoSelect")) {
                // check what type of object the element is
                if (interObj.type == "Group") {
                    console.log("WE'RE A GROUP")
                    this.pick(interObj);
                } else if (interObj.type == "Mesh") {
                    console.log("WE'RE A MESH")
                    this.pick(interObj);
                } else {
                    console.log("No object selected");
                }
            }
            index--;
        }
    }

    pick(object) {
        if (this.pickEnabled) {
            console.log("Object just picked: ");
            console.log(object);

            transformControls.detach();
            // attach controls if the object type allows it
            if (!object.userData.type.includes("NoSelect")) {
                transformControls.attach(object);
            }

            // set picked object
            this.pickedObject = object;
        }
    }
}
const pickPosition = { x: 0, y: 0 };
clearPickPosition();
function getCanvasRelativePosition(event) {
    const rect = myCanvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * rightSideContainer.clientWidth / rect.width,
        y: (event.clientY - rect.top) * rightSideContainer.clientHeight / rect.height,
    };
}

function disablePicking() {
    pickHelper.pickEnabled = false;
    console.log("Picking disabled");
}
function enablePicking() {
    pickHelper.pickEnabled = true;
    console.log("Picking enabled");
}

function clearPickPosition() {
    // unlike the mouse which always has a position
    // if the user stops touching the screen we want
    // to stop picking. For now we just pick a value
    // unlikely to pick something
    pickPosition.x = -100000;
    pickPosition.y = -100000;
}

//MOUSE DOWN CODE



















// SETUP






const pickHelper = new PickHelper();
//import * as THREE from './three';
var controls, dragControls, transformControls;
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x2A363B);

var myCanvas = document.getElementById("threeCanvas");

var camera = new THREE.PerspectiveCamera(45, myCanvas.clientWidth / myCanvas.clientHeight, 0.1, 5000);
var renderer = new THREE.WebGLRenderer({ canvas: myCanvas, antialias: true, powerPreference: "high-performance", });

renderer.setSize(myCanvas.clientWidth, myCanvas.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;

var loader = new THREE.GLTFLoader();
var textureLoader = new THREE.TextureLoader();

renderer.setClearColor(0xffffff, 0); // second param is opacity, 0 => transparent
controls = new THREE.OrbitControls(camera, renderer.domElement);
renderer.gammaFactor = 2.2;
renderer.gammaOutput = true;
renderer.outputEncoding = THREE.sRGBEncoding;

// LIGHTS AND BACKGROUND

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, .7);
hemiLight.position.set(0, 100, 40);
hemiLight.castShadow = false;
scene.add(hemiLight);

scene.fog = new THREE.Fog(0xa0a0a0, 300, 350);

const light = new THREE.SpotLight(0x444444, 1.5);
light.position.set(0, 100, 40);

light.shadow.bias = -0.00001;
light.shadow.mapSize.width = 1024 * 4;
light.shadow.mapSize.height = 1024 * 4;
light.castShadow = true;
scene.add(light);

scene.background = new THREE.Color(0x2A363B);

function resetCamera() {
    controls.reset();
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.rotateSpeed = 0.7;
    camera.position.set(0, 61.27639300930197, 21.183811053080007);
    camera.rotation.set(-0.3618175319112695, 0, -0.004617427467257444);
    controls.update();
    controls.target.set(0, 30.55, -60);
    controls.enabled = true;

    camera.lookAt(25, 8.5, 35);

    //parseShareableString("[ *PrimitiveBoxFloorFurnitureNoSelect|floor|0,0,-40,|0,0,0,|100,2,70,|darkParquet|* Monitor|small16x9Monitor28|0,30.800000000000004,-57,|0,4.71238898038469,0,| Mouse|defaultMouse|9,30.7,-50,|0,3.141592653589793,0,| Mousepad|QCKSmall|9,30.75,-50,|0,1.5707963267948966,0,| Keyboard|default60PercentKeyboardAllGrey|-3,30.85,-50,|0,4.71238898038469,0,| *FurniturePrimitiveBoxDeskNoSelect|customDesk|0,30.2,-53,|0,0,0,|50,1,20,|italianOak|* *PrimitiveBox|referenceBox|-12.456730542942143,33.2,-54.65369349806694,|0,0.906999410493721,0,|5,5,10,|null|* FurnitureChair|modernOfficeChair|0,2.8,-50,|0,4.71238898038469,0,| ]");
}

resetCamera();

// // copy of the above function for testing purposes
// function resetCamera1() {
//     controls.reset();
//     controls.enableZoom = true;
//     controls.enableRotate = true;
//     controls.enablePan = true;
//     controls.rotateSpeed = 0.7;
//     camera.position.set(0, 61.27639300930197, 21.183811053080007);
//     camera.rotation.set(-0.3618175319112695, 0, -0.004617427467257444);
//     controls.update();
//     controls.target.set(0, 30.55, -60);
//     controls.enabled = true;

//     camera.lookAt(25, 8.5, 35);
// }














// DECLARATION SECTION

var objectsArr = []; // 1D array to store all the objects currently in the scene
var pickObject = false; // not sure what this is about but I'm afraid to remove it

// transform controls. for dragging and rotating
transformControls = new THREE.TransformControls(camera, renderer.domElement);
transformControls.enabled = true;
transformControls.size = .7;
scene.add(transformControls);


























// EVENT LISTENERS

document.getElementById('threeCanvas').addEventListener('click', function () {
    enablePicking();
});

// event listener for a click on the controls
transformControls.addEventListener('mouseDown', function () {
    console.log("HIT TRANSFORM CONTROLS");
    pickObject = true;
    controls.enabled = false; // makes it so the camera doesn't rotate when you're trying to drag an object
});
transformControls.addEventListener('mouseUp', function () {
    controls.enabled = true; // ^ see above
});

// eventListener for a click in the window
var rightmousemove;
window.addEventListener('mousedown', function (event) {
    console.log("WINDOW MOUSE DOWN");
    rightmousemove = false;
    if (event.button == 2) {
        rightmousemove = true;
        //   // Right click
    }
    if (pickObject) {
        pickObject = false
    } else {
        console.log("RUNNING SET PICK POSITION");
        setPickPosition(event);
        pickObject = false
    }
});

// stops right click drag
document.addEventListener("mousemove", function (event) {
    if (rightmousemove === true) {
        event.stopImmediatePropagation();
    }
});

//window.addEventListener('mouseout', clearPickPosition);
//window.addEventListener('mouseleave', clearPickPosition);

window.addEventListener('resize', function () {
    camera.aspect = rightSideContainer.clientWidth / rightSideContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(rightSideContainer.clientWidth, rightSideContainer.clientHeight);
});

transformControls.showY = false; //Making the transform controls not show a Y direction.

function setPickPosition(event) {

    // right side container is a bootstrap column. contains the canvas
    const pos = getCanvasRelativePosition(event);
    pickPosition.x = (pos.x / rightSideContainer.clientWidth) * 2 - 1;
    pickPosition.y = (pos.y / rightSideContainer.clientHeight) * -2 + 1;  // note we flip Y

    pickHelper.mouseSelect(pickPosition);
}
var rotateActive = true;

// adds an event listener to the DOM element of the entire window. If any key is pressed, check the keyCode of the event with a switch statement and go from there
window.addEventListener('keydown', function (event) {

    switch (event.keyCode) {
        case 8: //BACKSPACE (Delete)
            objectsArr = pickHelper.deletePicked();
            break;
        case 46:
            objectsArr = pickHelper.deletePicked();
            break;
        case 68:
            objectsArr = pickHelper.deletePicked();
            break;
        case 67:
            transformControls.detach();
            pickHelper.pickedObject = null;
            return;
        case 82: // R
            if (rotateActive) {
                transformControls.showX = false;
                transformControls.showZ = false;
                transformControls.showY = true;
                transformControls.setMode("rotate");
                rotateActive = false;
            } else {
                transformControls.showX = true;
                transformControls.showZ = true;
                transformControls.showY = false;
                transformControls.setMode("translate");
                rotateActive = true;
            }
            break;
        case 187:
        case 107: // +, =, num+
            transformControls.setSize(transformControls.size + 0.1);
            break;

        case 189:
        case 109: // -, _, num-
            transformControls.setSize(Math.max(transformControls.size - 0.1, 0.1));
            break;

        case 88: // X
            transformControls.showX = !transformControls.showX;
            break;

        case 89: // Y
            transformControls.showY = !transformControls.showY;
            break;

        case 90: // Z
            transformControls.showZ = !transformControls.showZ;
            break;
    }

});

// does nothing
window.addEventListener('keyup', function (event) {

    switch (event.keyCode) {
        /*
        case 16: // Shift
            transformControls.setTranslationSnap(null);
            transformControls.setRotationSnap(null);
            transformControls.setScaleSnap(null);
            break;
        */
    }

});










// DICTIONARIES








let heightDiff = 0;
const coordinateDictionary = Object.fromEntries(Object.entries(products).map(([id, product]) =>
  [id, [...product.position, product.rotationY, product.modelPath, product.dimensions.imperial, product.dimensions.metric]]));

// INITIALIZATION





//Loader for the room
/*loader.load('rooms/room_2_no_roof.glb', function (gltf) {
    var theModel = gltf.scene;
    theModel.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    scene.add(gltf.scene);
}, undefined, function (error) {
    console.error(error);
});*/

function render() {
    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate); // asynch animate loop
    camera.updateProjectionMatrix();
    controls.update();
    renderer.render(scene, camera);
    //Commented out logs below print the current rotation and position of camera
    //console.log("CAMERA POSITION X,Y,Z: " + camera.position.x + ", " + camera.position.y + ", " + camera.position.z);
    //console.log("CAMERA ROTATION X,Y,Z: " + camera.rotation.x + ", " + camera.rotation.y + ", " + camera.rotation.z);
}
animate();
var x = 10;

function initializeObjects() {
    // primtive stuff
    addFloorInit("PrimitiveBoxFloorFurnitureNoSelect", "floor");
    // objects
    addDefault("DeskNoSelect", "modernDesk", false); // uses addDefault instead of addDesk because there is no previous desk
    addDefault("Monitor", "small16x9Monitor28", false);
    addDefault("Mouse", "defaultMouse", false);
    addDefault("Keyboard", "default60PercentKeyboardAllGrey", false);
    addDefault("Mousepad", "QCKSmall", false);
}
//initializeObjects();

function removeArrElem(array, index) {
    let tempArr = [];

    for (let i = 0; i < array.length; i++) {
        if (i != index) {
            tempArr.push(array[i]);
        }
    }

    return tempArr;
}












// OBJECT ADDING FUNCTIONS


// add a custom primitive desk
function addPrimitiveDesk(objectType, objectName) {
    enablePicking(); // this will get done again in addObject, but I need to do it here so the code to replace the desk works

    let geometry = new THREE.BoxBufferGeometry(document.getElementById(objectName + "L").value, "1", document.getElementById(objectName + "W").value);

    let textureName = document.getElementById(objectName + "Form").value;

    let texture = new THREE.TextureLoader().load(textureDictionary[textureName]);
    let material = new THREE.MeshLambertMaterial({ map: texture });
    material.name = textureName;

    pickHelper.pick(getObjectByType("Desk")[0]);
    let oldDesk = pickHelper.pickedObject.userData.objectName;
    pickHelper.deletePicked();

    // add object to scene and make a group
    let object = addPrimitive(objectType, objectName, geometry, material);

    updateDeskHeightDiff(objectName, oldDesk);

    let posArr = coordinateDictionary[objectName];
    object.position.set(posArr[0], posArr[1], posArr[2]);
}

// adds the floor for the intialization function
function addFloorInit(objectType, objectName) {
    let geometry = new THREE.BoxBufferGeometry(100, 2, 70);
    let texture = new THREE.TextureLoader().load(textureDictionary["darkParquet"]);
    let material = new THREE.MeshLambertMaterial({ map: texture });
    material.name = "darkParquet";

    let object = addPrimitive(objectType, objectName, geometry, material)

    object.position.set(0, 0, -40);
}

// add a reference primitive object
function addPrimitiveReference(objectType, objectName, replace) {
    // create box or sphere geometry
    let geometry;
    let width = 0;
    if (objectType.includes("Box")) {
        geometry = new THREE.BoxBufferGeometry(document.getElementById(objectName + "L").value,
            document.getElementById(objectName + "W").value,
            document.getElementById(objectName + "H").value);
        width = document.getElementById(objectName + "W").value / 2;
    } else if (objectType.includes("Sphere")) {
        geometry = new THREE.OctahedronBufferGeometry(document.getElementById(objectName + "Radius").value, 5);
        width = document.getElementById(objectName + "Radius").value;
    } else {
        console.log("Error: invalid primitive type");
    }

    // create material
    let material = new THREE.MeshLambertMaterial({ color: 0x202020 })
    material.name = "null";

    // add object to scene and make a group
    var object = addPrimitive(objectType, objectName, geometry, material); // this function is not getting called for some reason

    // set position, reset if object is being replaced, and delete previous object
    let position = new THREE.Vector3(0, 31.7 + heightDiff + (width - .5), -57);
    if (replace && pickHelper.pickedObject != null) {
        // only use x and z of the old object and keep y untouched
        position.set(pickHelper.pickedObject.position.x, position.y, pickHelper.pickedObject.position.z);
        pickHelper.deletePicked();
    }

    object.position.set(position.x, position.y, position.z);
    pickHelper.pick(object);
}


// add a primitive object base function
function addPrimitive(objectType, objectName, geometry, material) {
    enablePicking(); // resets pick enabled if it was disabled by something else

    let mesh = new THREE.Mesh(geometry, material);
    let object = new THREE.Group();
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // adds the primitive mesh to a group, so it is the same type as everything else in the scene
    object.add(mesh);

    // make sure the object is getting a unique name
    let highest = 0;
    let objCount = 0;
    for (let i = 0; i < objectsArr.length; i++) {
        objCount = getCountOfObject(objectsArr[i].name);
        if (objectsArr[i].userData.objectName == objectName && objCount >= highest) {
            highest = objCount + 1;
        }
    }

    object.name = objectName + "-" + highest;

    object.userData.type = objectType;
    object.userData.objectName = objectName;

    objectsArr.push(object);
    scene.add(object);

    console.log("New primitive just added to the scene: ");
    console.log(object);

    return object;
}

// add any object with a dropdown and checkbox field, including monitors
function addMonitor(objectType, objectNameBase, replace) {
    // check size
    let objectName = objectNameBase + document.getElementById(objectNameBase + "Form").value;

    // check for stand
    if (document.getElementById(objectNameBase + "Stand").value == "on") {
        objectName += "NoStand";
    }

    addDefault(objectType, objectName, replace);
}

// add an object with one custom parameter
function addCustom(objectType, baseObjectName, replace) {
    let objectName = baseObjectName + document.getElementById(baseObjectName + "Form").value;

    addDefault(objectType, objectName, replace);
}

// basic add function for adding a gltf. 
function addDefault(objectType, objectName, replace) {
    addObject(objectName, function (object) {
        let coordDictArr = coordinateDictionary[objectName];

        let pos = new THREE.Vector3(coordDictArr[0], coordDictArr[1], coordDictArr[2]);
        let rot = new THREE.Vector3(0, coordDictArr[3], 0);

        object.userData.type = objectType;

        // replace object if replace is true
        if (replace && pickHelper.pickedObject != null) {
            // only use x and y of the old object
            pos.set(pickHelper.pickedObject.position.x, pos.y, pickHelper.pickedObject.position.z);
            pickHelper.deletePicked();
        }
        pickHelper.pick(object);

        // set position and rotation
        object.position.set(pos.x, pos.y, pos.z);
        object.rotation.set(rot.x, rot.y, rot.z);

        return object;
    });
}

// add object using dictionary coords. Most barebones add function. Won't work right called on its own
function addObject(objectName, callBack) {
    enablePicking(); // resets pick enabled if it was disabled by something else

    let filePath = coordinateDictionary[objectName][4];

    loader.load(filePath, function (gltf) {
        let object = gltf.scene.children[0];

        // for loop to check if there are any duplicate objects
        let highest = 0;
        let objCount = 0;
        for (let i = 0; i < objectsArr.length; i++) {
            objCount = getCountOfObject(objectsArr[i].name);
            if (objectsArr[i].userData.objectName == objectName && objCount >= highest) {
                highest = objCount + 1;
            }
        }

        // give object unique name and basic name
        object.name = objectName + "-" + highest;
        object.userData.objectName = objectName;

        // shadows
        gltf.scene.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });

        objectsArr.push(object); // create new group at end of array
        scene.add(object);

        object = callBack(object);


        console.log(objectName + " was just added to the scene. Object: ");
        console.log(object);

        //createShareableString();
        x = x + 1; // idk what this is
    }, undefined, function (error) {
        console.error(error);
    });
}

// add desk
function addDesk(objectType, objectName) {
    enablePicking(); // this will get done again in addObject, but I need to do it here so the code to replace the desk works

    // pick the old desk, store it, and delete it
    pickHelper.pick(getObjectByType("Desk")[0]);
    let oldDesk = pickHelper.pickedObject.userData.objectName;
    pickHelper.deletePicked();

    // call base function for adding single object
    addDefault(objectType, objectName, false);

    // update height of all objects and unselect the new desk so it can't be accidentally deleted
    updateDeskHeightDiff(objectName, oldDesk);
    pickHelper.unselectPickedObject();
}

function addDeskCustom(objectType, baseObjectName) {
    enablePicking(); // this will get done again in addObject, but I need to do it here so the code to replace the desk works

    // pick the old desk, store it, and delete it
    pickHelper.pick(getObjectByType("Desk")[0]);
    let oldDesk = pickHelper.pickedObject.userData.objectName;
    pickHelper.deletePicked();

    // get exact name of the object to add using the form
    let objectName = baseObjectName + document.getElementById(baseObjectName + "Form").value

    // call base function now that we have the complete name
    addDefault(objectType, objectName, false);

    // update heighy for all objects
    updateDeskHeightDiff(objectName, oldDesk);
}

// add an object with position and rotation as inputs
function addDefaultPosRot(objectType, objectName, posi, roti) {
    console.log("OBJECT NAME");
    console.log(objectName);

    addObject(objectName, function (object) {
        let pos = posi;
        let rot = roti;

        object.userData.type = objectType;

        pickHelper.pick(object);

        // set position and rotation
        object.position.set(pos.x, pos.y, pos.z);
        object.rotation.set(rot.x, rot.y, rot.z);

        return object;
    });
}

function addPrimitivePosRotDimText(objectType, objectName, pos, rot, dim, textureName) {
    // create box or sphere geometry
    let geometry = null;
    let width = 0;
    if (objectType.includes("Box")) {
        geometry = new THREE.BoxBufferGeometry(dim.x, dim.y, dim.z);
    } else if (objectType.includes("Sphere")) {
        geometry = new THREE.OctahedronBufferGeometry(dim.x, 5);
    } else {
        console.log("Error: invalid primitive type");
    }

    let texture = null;
    let material = null;
    // create material
    if (textureName != "null") {
        texture = new THREE.TextureLoader().load(textureDictionary[textureName]);
        material = new THREE.MeshLambertMaterial({ map: texture });
    } else {
        material = new THREE.MeshLambertMaterial({ color: 0x202020 });
    }
    material.name = textureName;

    // add object to scene and make a group
    var object = addPrimitive(objectType, objectName, geometry, material);

    object.position.set(pos.x, pos.y, pos.z);
    object.rotation.set(rot.x, rot.y, rot.z);

}



















// OTHER FUNCTIONS



// finds any objects that have a type string with the objectType string in it, and a returns an array of those objects
function getObjectByType(objectType) {
    var object = [];
    for (let i = 0; i < objectsArr.length; i++) {
        if (objectsArr[i].userData.type.includes(objectType)) {
            object.push(objectsArr[i]);
        }
    }

    return object;
}

// !!! unsure if this works. but it's not currently used
function getObjectByObjectName(objectName) {
    var object = [];
    for (let i = 0; i < objectsArr.length; i++) {
        if (objectsArr[i].userData.objectName == objectName) {
            object.push(objectsArr[i]);
        }
    }

    return object;
}

// extract the number from the object's unique name string
function getCountOfObject(objectName) {
    let index = objectName.length - 1;
    while (objectName.charAt(index) != '-' && index >= 0) {
        index--;
    }
    return parseInt(objectName.substring(index + 1));
}

function updateDeskHeightDiff(deskName, oldDesk) {
    let position = new THREE.Vector3();
    let object;

    for (let i = 0; i < objectsArr.length; i++) {
        object = objectsArr[i];
        position = object.position;
        if (!object.userData.type.includes("Furniture")) {

            object.position.set(position.x, position.y + (deskHeightDiff[deskName] - deskHeightDiff[oldDesk]), position.z);
        }
    }
    heightDiff = deskHeightDiff[deskName];
}

// clears the scene of all objects
function resetScene() {
    for (let i = objectsArr.length - 1; i >= 0; i--) {
        console.log("REMOVED:");
        console.log(objectsArr[i]);

        enablePicking();

        pickHelper.pick(objectsArr[i]);
        pickHelper.deletePicked();
    }
    console.log("OBJECTS ARRAY AFTER RESET:");
    console.log(objectsArr);
}

// takes in the shareable string and places all the objects contained in it
function parseShareableString(text) {
    // Validate everything before touching the live scene.
    const records = decodeSetup(text);
    pickHelper.unselectPickedObject();
    resetScene();
    heightDiff = 0;
    for (const record of records) {
        if (record.type.includes('Desk')) updateDeskHeightDiff(record.product, 'modernDesk');
        const position = new THREE.Vector3(...record.position);
        const rotation = new THREE.Vector3(...record.rotation);
        if (record.dimensions) {
            addPrimitivePosRotDimText(record.type, record.product, position, rotation,
                new THREE.Vector3(...record.dimensions), record.texture);
        } else {
            addDefaultPosRot(record.type, record.product, position, rotation);
        }
    }
}

function createShareableString() {
    return encodeSetup(objectsArr.map(objectToRecord));
}

function createCustomLink() {
    return createShareUrl(createShareableString(), window.location.href);
}

function loadCustomSetup() {
    const setup = readSetupParameter(window.location.href);
    if (setup !== null) {
        try {
            parseShareableString(setup);
            return;
        } catch (error) {
            console.error(error);
        }
    }
    initializeObjects();
}
loadCustomSetup();

// Temporary adapter for the retained inline handlers during incremental extraction.
Object.assign(window, { validate, disablePicking, enablePicking, resetCamera,
 addDefault, addCustom, addMonitor, addDesk, addDeskCustom, addPrimitiveDesk, addPrimitiveReference });
for (const [name, read] of Object.entries({ objectsArr: () => objectsArr, renderer: () => renderer,
 scene: () => scene, transformControls: () => transformControls })) {
 Object.defineProperty(window, name, { configurable: true, get: read });
}
