import { createScene } from '../scene/createScene.js';
import { createSelection } from '../interactions/selection.js';
import { bindPointer } from '../interactions/pointer.js';
import { bindKeyboard } from '../interactions/keyboard.js';
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

const myCanvas = document.getElementById('threeCanvas');
const { scene, camera, renderer, controls, transformControls, resetCamera } = createScene({
    THREE, canvas: myCanvas, container: rightSideContainer, host: window,
});
let objectsArr = [];
const loader = new THREE.GLTFLoader();
const pickHelper = createSelection({ THREE, camera, transformControls,
    getObjects: () => objectsArr,
    removeObject(object) {
        scene.remove(object);
        objectsArr = objectsArr.filter((candidate) => candidate !== object);
    },
});
bindPointer({ host: window, document, canvas: myCanvas, selection: pickHelper, controls, transformControls });
bindKeyboard({ host: window, selection: pickHelper, transformControls });
function enablePicking() { pickHelper.pickEnabled = true; }
function disablePicking() { pickHelper.pickEnabled = false; }

let heightDiff = 0;
const coordinateDictionary = Object.fromEntries(Object.entries(products).map(([id, product]) =>
  [id, [...product.position, product.rotationY, product.modelPath, product.dimensions.imperial, product.dimensions.metric]]));

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
