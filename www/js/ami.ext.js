/**
 * @fileoverview Externs for AMI r0.23-dev API.
 * @see http://code.google.com/apis/maps/documentation/javascript/reference.html
 * @externs
 */

var AMI = {
    "SeriesModel": {
        "seriesInstanceUID": {},
        "studyInstanceUID": {},
        "transferSyntaxUID": {},
        "seriesDate": {},
        "seriesDescription": {},
        "studyDate": {},
        "studyDescription": {},
        "numberOfFrames": {},
        "numberOfChannels": {},
        "modality": {},
        "patientID": {},
        "patientName": {},
        "patientAge": {},
        "patientBirthdate": {},
        "patientSex": {},
    },
    "VolumeLoader": {
        "loadSequence":function() {},
        "loadSequenceGroup":function() {},
    },
    "DicomParser": {
        "_dataSet":{},
        "string":{}
    },
    "TrackballControl":{
        "rotateSpeed":0,
        "zoomSpeed":0,
        "panSpeed":0,
        "staticMoving":0,
        "dynamicDampingFactor":0
    },
    "OrthographicCamera": {
        "invertColumns": function() {},        
    },
    "TrackballOrthoControl": {
        "noRotate":0,
    },
    "StackHelper": {
        "bbox":{},
        "canvasWidth":0,
        "canvasHeight":0,
        "orientationMaxIndex":0,
        "halfDimensions":0,
        "_stack":{}
    },
    "StackModel": {
        "merge": function() {},
    },
    "FrameModel": function() {},
    "BorderHelper": {
        "helpersSlice":0,
        "_update": function() {},
        "_mesh": 0,
        "_geometry": 0,
        "_material": 0,
    },
    "IntersectionsCore": {
        "aabbPlane": function() {},
    },
    "SliceGeometry":function() {},
    "stack": {
       "worldBoundingBox":function() {},
        "worldCenter":function() {},
        "prepare":function() {},
        "xCosine":0,
        "yCosine":0,
        "zCosine":0,
        "lps2IJK":{},
        "ijk2LPS":{},
        "minMax":{},
        "dimensionsIJK":{},
        "_spacing":{},
    },
    "slice": {
        "geometry": null,
        "cartesianEquation": function() {},
        "windowWidth":0,
        "windowCenter":0,
        "intensityAuto":0,
    },
    "LocalizerHelper":function() {},
    "BoundingBoxHelper":function() {},
    "ContourHelper":function() {},
    "UtilsCore": {
        "worldToData":function() {},
        "getPixelData":function() {},
    },
    "point": {}
};
AMI.OrthographicCamera.prototype = {
    "fitBox": function() {},
    "directions":[],
    "box": {},
    "stackOrientation":0,
    "quaternion":{},
    "aspect":{}
};

AMI.ContourHelper.prototype = {
    "canvasWidth": 0,
    "canvasHeight": 0,
    "textureToFilter": null,
    "contourWidth": 0,
    "contourOpacity": 0,
    "texture" : 0
};

AMI.ModelsSeries.prototype = {
    "mergeSeries": function() {}
};

AMI.VolumeLoader.prototype = {
    "free": function() {}
};

// AMI.StackModel.prototype = {
//     "merge": function() {}
// };
