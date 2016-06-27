/**
 * Created by tangzhi.ye at 2015/11/24
 * model for default setting
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone'
], function(require, Mn, _, $, Backbone) {
    'use strict';

    return window.Config = new (Backbone.Model.extend({
        defaults: {
            'test': null,
            'dataLibrary': {
                "Iris": "data/Iris.csv",
                "Car": "data/Car.csv",
                "Serum": "data/serum.csv",
                "C2": "data/C2.csv",
                "Food": "data/food.csv",
                "Wine": "data/wine.csv",
                "3DBall": "data/3DBall.csv",
                "2DPlanes": "data/2DPlanes.csv",
                "Swissroll": "data/swissroll.csv",
                "Synthetic": "data/synthetic.csv",
                "Abalone": "data/abalone.csv",
            },
            'dataPath': 'data/Car.csv',//Iris.csv, Car.csv, 3DBall.csv, 2DPlanes.csv, swissroll.csv
            'currentData': 'Car',
            'distType': "Weighting",//"Weighting", "KNN", "ErrorReducing"
            'sampleCount': 100,
            'dimRange': [2, Infinity],
            'cluster': null,
            'clusterNumber': null,
            'clusterColors': null,
            'colorInPicker': null,
            'colorPickerLeft': null,
            'changeColorID': null,
            'changeTitleID': null,
            'cordDistType': "Binet–Cauchy",//"Chordal","Binet–Cauchy"
            'lightingOn': false,
            'lighting': 'light',
            "mouseOver": false,
            'showContext': true,
            'showVector': false,
            'showAxis': true,
            'focusType': 'Group',
            'groupOn': true,
            'useCentroid': true,
            'fontSize': 12,
            'fontSizeLarge': 15,
            'currentColor': "#333",
            'useSubspace': false,
            'changeSubspace': false,
            'suggestion': null,
            'modification': "None",
            'changeSuggestion': false,
            'subspaceAll': [],
            'subspace': [],
            'subThreshold': 0.75,
            'layout': {
                globalHeight: null,
                globalWidth: null,
                globalTop: null,
                globalMargin: null,
                leftWidthRatio: 0.49,
                rightWidthRatio: 0.49,
                marginRatio: 0.006,
                leftTopHeightRatio: 0.98,
                leftBtmHeightRatio: 0.00,
                leftMidHeightRatio: 0.00,
                rightTopHeightRatio: 0.98,
                rightBtmHeightRatio: 0.00,
                rightMidHeightRatio: 0.00,
                marginBottomRatio: 0.02,
                left:{
                },
                rightBtm:{
                },
                rightTop:{
                },
            },
            'childviewLayout': {
                width: null,
                height: null,
                topRatio: 0.00,
                marginRatio: 0.00,
            },
            'data': {
                data: null,
                dimensions: null,
                distances: null,
                array: null,
                vectors: null,
                coordinates: null,
            },
            'color': {
                light: "#000",
                median: "#fafafa",
                dark: "#111",
            },
            'lightColor': {
                light: "#fff",
                median: "#ccc",
                dark: "#333",
            },
            'transition': {
                duration: 500,
                quick: 200,
                interval: 50,
            },
        },
    }))();
});
