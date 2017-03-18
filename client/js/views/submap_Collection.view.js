define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'jqueryui',
    'hexbin',
    'voronoi',
    'backbone',
    'loadingjs',
    'datacenter',
    'config',
    'Base',
    'basicFunctions',
    'basicViewOperations',
    'Tiling',
    'SubRotate',
    'SubGlyph',
    'SubMap_ModelView',
    ], function(require, Mn, _, $, JQueryUI, HexBin, Voronoi, Backbone, LoadingJS, Datacenter, Config, Base, 
        loadBasic, loadBasicView, Tile, Subrotate, Subglyph, SubMap_ModelView) {
        'use strict';
        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

        var SubMap_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"SubMap",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var t_width = parseFloat($("#SubMap_CollectionViewSVG").css("width")),
                    t_height = parseFloat($("#SubMap_CollectionViewSVG").css("height")),
                    t_drawSize = Config.get("drawSize"),
                    t_showSize = Math.min(t_width, t_height);
                var t_defaults = {
                        canvasSize: t_drawSize,
                        size: t_showSize,
                        sizeTolr: (Number.EPSILON * 1000) * (t_showSize / t_drawSize),
                        scales: {
                            x: d3.scale.linear().range([-t_drawSize * 0.5, t_drawSize * 0.5]).domain([0,1]),
                            y: d3.scale.linear().range([-t_drawSize * 0.5, t_drawSize * 0.5]).domain([0,1]),
                        },
                        r: 2,
                        dimCover: [],
                        ovlDataWeights: null,
                        ovlDataLength: null,
                        distMat: null,
                        diffMat: null,
                        distExt: null,
                        nghList: null,
                        zoomed: false,
                        newData: true,
                        visible: null,
                        pattern: false,
                        nghDims: null,
                        clsAggr: null,
                        freeDim: null,
                        fCodes: null,
                        fMatrix: null,
                        colors: null,
                        currentColors: null,
                        colorFixed: false,
                        transition: Config.get("transition"),
                        overallCls: {
                            clusters: null,
                            level: null,
                            paths: null,
                            aggregate: null,
                        },
                        currentCls: {
                            clusters: null,
                            level: null,
                            paths: null,
                            aggregate: null,
                        },
                        isNew: true,
                        overallMap: null,
                        mapTransition: {
                            indeces: null,// old indeces
                            tranIndeces: null,// transition from old to current indeces
                            nameBook: null,// original id to current indeces
                            colors: null,
                        },
                        snapshotPar: {
                            ringR: null,
                            ringRRatio: 0.50,
                            marginRatio: 0.01,
                            sshotR: null,
                            sshotRRatio: 0.05,
                            outR: null,
                            anchorR: 4,
                            angInterval: 2,
                        },
                        interactions: {
                            ready: false,
                            hoveredID: null,
                        },
                        clsColorReady: false,
                    };
                Config.set("test",this);
                options = options || {};
                _.extend(this, options);
                _.extend(this, t_defaults);
                this.layout = Config.get("childviewLayout");
                this.listenTo(Config, "change:gridNumber", this.showMap);
                this.listenTo(this.collection, "SubMapCollection__ShowMap", this.showMap);
                this.listenTo(this.collection, "SubMapCollection__UpdateProgress", this.updateProgress);
                this.listenTo(Datacenter, "SubListCollectionView__getDimensionCoverage", this.getDimCoverage);
            },

            onShow: function(){
                let t_width = parseFloat($("#SubMap_CollectionViewSVG").css("width")),
                    t_height = parseFloat($("#SubMap_CollectionViewSVG").css("height")),
                    t_scale = this.size / this.canvasSize,
                    t_translate = [t_width / 2, t_height / 2];
                d3.select("#SubMap_CollectionView")
                .attr("transform", "translate(" + t_translate + ")scale(" + t_scale + ")");
            },

            bindAll: function(){
                let t_replaceFunc = (v_func, v_obj) => {
                    return function(v_data){
                        v_func.call(v_obj, v_data);
                    };
                };
                let t_interactions = this.interactions,
                    t_filterByDims = t_interactions.filterByDims,
                    t_filterByIDs = t_interactions.filterByIDs,
                    t_pinByIDs = t_interactions.pinByIDs,
                    t_zoomByDims = t_interactions.zoomByDims;
                // this.listenTo(this.collection, "SubMapCollection__ShowModels", this.showModels);
                this.listenTo(Datacenter, "SubListCollectionView__FilterByIDs", t_replaceFunc(t_filterByIDs, t_interactions));
                this.listenTo(Datacenter, "SubListCollectionView__PinByIDs", t_replaceFunc(t_pinByIDs, t_interactions));
                this.listenTo(Datacenter, "SubListCollectionView__FilterByDims", t_filterByDims);
                this.listenTo(Datacenter, "SubListCollectionView__ZoomByDims", t_zoomByDims);
                this.bindTuning();
            },

            updateProgress: function(v_parameters, v_show = true){
                if(v_show){
                    Loading.selector('body').progressBar(true).text(v_parameters[0]).progressVal(v_parameters[1]).show(true).update();
                }else{
                    Loading.selector('body').show(false).update();
                }
            },

            initInteractions: function(){
                let t_this = this,
                    t_d3el = this.d3el,
                    t_collection = this.collection,
                    t_interactions = this.interactions,
                    t_duration = this.transition.duration,
                    t_longDuration = this.transition.long,
                    t_indeces = this.fCodes.dataIndeces;
                if(!t_interactions.ready){
                    t_interactions.ready = true;
                    t_interactions.duration = t_duration;
                    t_interactions.container = t_this.d3el;
                    t_interactions.clickTimer = null;
                    t_interactions.checkRelation = function(v_clsID_1, v_clsID_2, v_type){
                        let t_lengthFit = false,
                            t_end = false,
                            t_fit = true,
                            t_ovlLength;
                        switch(v_type){
                            case "fellows":// same level
                                t_fit = (v_clsID_2.length == v_clsID_1.length);
                                t_end = true;
                            break;
                            case "brothers":// same level, same parent
                                t_lengthFit = (v_clsID_2.length == v_clsID_1.length);
                                t_ovlLength = v_clsID_1.length - 1;
                            break;
                            case "descendants":// the whole subtree
                                t_lengthFit = (v_clsID_2.length > v_clsID_1.length);
                                t_ovlLength = v_clsID_1.length;
                            break;
                        }
                        if(!t_lengthFit){
                            return false;
                        }
                        if(t_end){
                            return t_fit;
                        }
                        for(let i = 0; i < t_ovlLength; i++){
                            if(v_clsID_2[i] != v_clsID_1[i]){
                                t_fit = false;
                                break;
                            }
                        }
                        if(v_type == "brothers"){
                            t_fit = t_fit && (v_clsID_2[t_ovlLength] != v_clsID_1[t_ovlLength]);
                        }
                        return t_fit;
                    };
                    t_interactions.standOut = function(v_this, v_clsID){    
                        d3.select(v_this)
                        .selectAll("line")
                        .classed("chosen", true)
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("stroke", "#000")
                        .attr("stroke-opacity", 1.0);
                        let t_d3 = this.container;
                        // t_d3.selectAll(".SubMapSShot")
                        // .classed("chosen", false)
                        // .selectAll(".SubMapSnapshot")
                        // .interrupt()
                        // .transition()
                        // .attr("opacity", 0.6);
                        let t_selection = t_d3.selectAll(".SubMapSShot")
                        .filter(function(){
                            let t_clsID = d3.select(this).attr("clsID");
                            return t_clsID == v_clsID;
                        })
                        let t_jSelection = t_selection[0];
                        BasicView.showOnTop(t_jSelection, $(t_jSelection).parent()[0]);
                        // t_selection
                        // .classed("chosen", true)
                        // .selectAll(".SubMapSnapshot")
                        // .interrupt()
                        // .transition()
                        // .attr("opacity", 1.0);
                    };
                    t_interactions.fadeOutAll = function(){
                        let t_d3 = this.container;
                        t_d3.selectAll(".SubMapClusters path")
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("fill-opacity", 0.0);
                        t_d3.selectAll(".SubMapClusters line")
                        .classed("chosen", false)
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("stroke", "#666")
                        .attr("stroke-opacity", 0.8);
                        // t_d3.selectAll(".SubMapSShot")
                        // .classed("chosen", false)
                        // .selectAll(".SubMapSnapshot")
                        // .interrupt()
                        // .transition()
                        // .attr("opacity", 0.6);
                    }
                    t_interactions.fadeOutOthers = function(v_class){                                
                        //Fade out other clusters and outliers
                        let t_gsFaded = this.container.selectAll(".SubMapClusters")
                        .filter(function(vv_d, vv_i){
                            let tt_class = d3.select(this).attr("class");
                            return v_class != tt_class;
                        });
                        t_gsFaded
                        .selectAll("path")
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("fill-opacity", 0.8);
                        t_gsFaded
                        .selectAll("line")
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("stroke-opacity", 0);
                    };
                    t_interactions.saveBrothers = function(v_clsIDs){
                        let t_gsBrothers = this.container.selectAll(".SubMapClusters")
                        .filter(function(vv_d, vv_i){
                            let tt_clsIDs = d3.select(this).attr("clsID");
                            if(tt_clsIDs != null){
                                tt_clsIDs = tt_clsIDs.split("_");
                            }
                            if(d3.select(this).classed("Outliers")){
                                let t_parent_clsIDs = v_clsIDs.slice(0, v_clsIDs.length - 1);
                                return t_checkRelation(t_parent_clsIDs, tt_clsIDs, "descendants");
                            }else{
                                return t_checkRelation(v_clsIDs, tt_clsIDs, "brothers");
                            }
                        });
                        t_gsBrothers
                        .selectAll("path")
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("fill-opacity", 0.1);
                        t_gsBrothers
                        .selectAll("line")
                        .interrupt()
                        .transition()
                        .duration(this.duration)
                        .attr("stroke", "#666")
                        .attr("stroke-opacity", 1.0);
                    };
                    t_interactions.mouseOver = function(v_this, v_isOut){
                            if(!v_isOut){
                                BasicView.showOnTop(v_this, ".SubMapTiling");
                                let t_clsIDs = d3.select(v_this).attr("clsID"),
                                    t_ids;
                                if(t_clsIDs != null && t_clsIDs.length > 0){
                                    let t_getCls = t_this.getClsByIDs;
                                    t_clsIDs = t_clsIDs.split("_");
                                    t_ids = this.filterByIDs(t_getCls.call(t_this, t_clsIDs));
                                    let t_subTree = t_collection.subTree.findByIndex(t_clsIDs),
                                        t_weights = t_subTree.data.dataWeights;
                                    let t_ovlWeights = t_this.ovlDataWeights = t_collection.subTree.data.dataWeights;
                                    t_weights = numeric.sub(t_ovlWeights, t_weights);
                                    this.informOthers(t_ids, t_weights, false);
                                    t_this.informOthers("SubMapCollectionView__Highlighting", t_clsIDs);
                                };
                                // let t_class = d3.select(v_this).attr("class"),
                                //     t_clsIDs = d3.select(v_this).attr("clsID");
                                this.standOut(v_this, t_clsIDs);
                                // if(t_clsIDs != null){
                                //     t_clsIDs = t_clsIDs.split("_");
                                // };
                                // if(t_clsIDs.length > 1){
                                //     this.fadeOutOthers(t_class);
                                //     this.saveBrothers(t_clsIDs);
                                // }
                                // if(t_clsIDs != null && t_clsIDs.length > 0){
                                //     this.informOthers(t_clsIDs);
                                // }
                            }
                    };
                    t_interactions.mouseOut = function(v_isOut){
                            if(!v_isOut){
                                this.fadeOutAll();
                                let t_ids = this.filterByIDs();
                                this.informOthers(t_ids, false);
                                t_this.informOthers("SubMapCollectionView__Highlighting", null);
                                this.filterByIDs();
                                this.informOthers();
                            }
                    };
                    t_interactions.informOthers = function(v_ids, v_weights, v_translate = true, v_pin = false){
                        let t_IDs;
                        if(v_ids != null){
                            if(v_translate){
                                t_IDs = t_this.getClsByIDs(v_ids);
                            }else{
                                t_IDs = v_ids;
                            }
                        }
                        let t_message;
                        if(v_pin){
                            this.projectByIDs(t_IDs);
                            t_message = "SubMapCollectionView__Pin";
                        }else{                         
                            t_message = "SubMapCollectionView__Choose";
                        }
                        t_this.informOthers(t_message, {
                            attr: "index",
                            IDs: t_IDs,
                            weights: v_weights,
                            inform: false,
                        });
                    };
                    t_interactions.pinning = function(v_this, v_isBlock = true){
                        let t_d3 = d3.select(v_this),
                            t_pinned = t_d3.classed("pinned"),
                            t_getCls = t_this.getClsByIDs,
                            t_ids;
                        t_d3el.selectAll(".SubMapClusters.pinned").classed("pinned", false);
                        if(!t_pinned){
                            if(v_isBlock){
                                let t_clsIDs = t_d3.attr("clsID").split("_");
                                t_ids = t_getCls.call(t_this, t_clsIDs);
                                t_ids = SubGlyph.pickGlyphsByIDs(t_d3el, t_ids, "index");
                                t_d3.classed("pinned", true);
                            }else{
                                t_ids = [t_d3.attr("index")];
                                t_ids = SubGlyph.pickGlyphsByIDs(t_d3el, t_ids, "index");
                            }
                        }else{
                            SubGlyph.pickGlyphsByIDs(t_d3el, null, "index");
                            // t_d3.classed("pinned", false);
                        }
                        this.informOthers(t_ids, null, false, true);
                    };
                    t_interactions.filterByDims = function(v_filterSetting){
                        let t_needed = v_filterSetting.needed,
                            t_indeces = SubGlyph.filterGlyphsByDims(t_d3el, v_filterSetting, "index"),
                            t_illegal = (v_filterSetting.filter((v_d) => {return v_d != 0;}).length < 2),
                            t_return = {
                                indeces: t_indeces,
                                illegal: t_illegal,
                            };
                        // SubGlyph.filterGlyphs(t_gs, null, false);
                        t_collection.trigger("Transmission", {
                            type: "trans",
                            message: "SubMapCollectionView__Filtering",
                            data: t_return,
                        });
                    };
                    t_interactions.filterByIDs = function(v_ids){
                        return SubGlyph.filterGlyphsByIDs(t_d3el, v_ids, "index");
                    };
                    t_interactions.pinByIDs = function(v_ids){
                        t_d3el.selectAll(".SubMapClusters.pinned").classed("pinned", false);
                        SubGlyph.pickGlyphsByIDs(t_d3el, v_ids);
                        this.projectByIDs(v_ids);
                    };
                    t_interactions.projectByIDs = function(v_ids){
                        let t_codes;
                        if(v_ids == null || v_ids.length == 0){
                            t_collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__DefaultProjection", data: null});
                        }else{
                            let t_codeBook = t_collection.subIndex;
                            if(v_ids.length == 1){
                                let t_codes = t_codeBook[v_ids[0]],
                                    t_code = this.fixCode(t_codes);
                                t_collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: t_code});
                            }else{
                                let t_codes = t_codeBook[v_ids[0]],
                                    t_code = this.fixCode(t_codes);
                                t_collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: t_code});
                            }
                        }
                    };
                    t_interactions.fixCode = function(v_code){
                        let t_cover = t_this.dimCover,
                            t_length = t_cover.length,
                            t_code = new Array(t_length),
                            t_count = 0;
                        for(let i = 0; i < t_length; i++){
                            if(t_cover[i] >= 0){
                                t_code[i] = t_cover[i];
                            }else{
                                t_code[i] = v_code[t_count];
                                t_count++;
                            }
                        }
                        return t_code;
                    };
                    let t_subzoom = (v_zoomin) => {
                        let t_free = 0, t_fixed = 0;
                        for(let i = 0; i < t_this.dimCover.length; i++){
                            if(t_this.dimCover[i] < 0){
                                t_free ++;
                            }else{
                                t_fixed ++;
                            }
                        }
                        if((v_zoomin && t_free < 3) || (!t_this.zoomed && !v_zoomin)){
                            return;
                        }else{
                            if((!v_zoomin) || (v_zoomin && t_free < t_this.freeDim)){
                                t_this.zoomed = v_zoomin;
                                t_this.freeDim = v_zoomin?t_free:t_this.dimCover.length;
                                t_this.pipeline();
                            }
                        }
                    };
                    t_interactions.zoomByDims = function(v_data){
                        let t_dims = v_data.dims,
                            t_zoomin = v_data.zoomin;
                        if(t_dims != null){
                            t_this.dimCover = t_dims;
                            t_subzoom(t_zoomin);
                        }
                    };
                }
            },

            informOthers: function(v_message, v_data){
                this.collection
                .trigger("Transmission", {
                    type: "trans",
                    message: v_message,
                    data: v_data,
                });
            },

            showMap: function(){
                let t_df = $.Deferred();
                this.clearAll();
                this.pipeline(t_df);
                this.bindAll();
                $.when(t_df).done(() => {
                    this.updateProgress(null, false);
                })
            },

            pipeline: function(v_df){
                let t_dfColors = $.Deferred(),
                    t_dfCls = $.Deferred(),
                    t_dfRing = $.Deferred();
                this.clearCanvas();
                // this.showProjection();
                // this.showGrids();
                this.filtering();
                this.initInteractions();
                this.coloring(t_dfColors);
                $.when(t_dfColors).done(() => {
                    this.clustering(t_dfCls);
                });
                $.when(t_dfCls).done(() => {
                    this.showTiling(t_dfRing);
                });
                $.when(t_dfRing).done(() => {
                    // this.showRing();
                    // this.showSnapshot();
                    if(v_df != null){
                        v_df.resolve();
                    }
                });
            },

            filtering: function(){
                let t_filterMatrix = (v_codeBook, v_indeces) => {
                    let t_dataLength = this.ovlDataLength = v_codeBook.length;
                    if(!this.distMat){
                        this.distMat = this.collection.dataDist;
                    }
                    if(!this.diffMat){
                        let t_diffMat = Basic.initArray(t_dataLength, t_dataLength);
                        for(let i = 0; i < t_diffMat.length - 1; i++){
                            for(let j = i + 1; j < t_diffMat[i].length; j++){
                                let tt_code_i = v_codeBook[i],
                                    tt_code_j = v_codeBook[j],
                                    t_dist = 0;
                                for(let k = 0; k < tt_code_i.length; k++){
                                    if(tt_code_i[k] != tt_code_j[k]){
                                        t_dist++;
                                    }
                                }
                                t_diffMat[i][j] = t_diffMat[j][i] = t_dist;
                            }
                        }
                        this.diffMat = t_diffMat;
                    }
                    if(!this.nghList){
                        this.nghList = this.collection.subNghList;
                    }
                    if(!this.distExt){
                        this.distExt = Basic.extArray(this.distMat);
                    }
                    if(!this.colors){
                        this.colors = this.collection.colors;
                    }
                    if(v_indeces == null){
                        this.updateMapTrans();
                        return {
                            neighbors: this.nghList,
                            distMat: this.distMat,
                            diffMat: this.diffMat,
                            distExt: this.distExt,
                            colors: this.colors,
                        };
                    }else{
                        let t_distMat = Basic.subArray(this.distMat, v_indeces, v_indeces),
                            t_diffMat = Basic.subArray(this.diffMat, v_indeces, v_indeces),
                            t_nghList = Basic.KNNGByDistMat(t_distMat, Config.get("SUB_K")),
                            t_distExt = Basic.extArray(t_distMat);
                        this.updateMapTrans(v_indeces);
                        return {
                            neighbors: t_nghList,
                            distMat: t_distMat,
                            diffMat: t_diffMat,
                            distExt: t_distExt,
                            colors: null,
                        };
                    }
                }, t_filterCodes = (v_codes, v_dimCover) => {
                    let t_empty = true, t_dimIndeces;
                    if(v_dimCover != null){
                        for(let i = 0; i < v_dimCover.length; i++){
                            if(!t_empty){
                                continue;
                            }
                            if(v_dimCover[i] >= 0){
                                t_empty = false;
                            }
                        }
                    }
                    if(t_empty){
                        t_dimIndeces = new Array(v_codes[0].length);
                        for(let i = 0; i < t_dimIndeces.length; i++){
                            t_dimIndeces[i] = i;
                        }
                        return {
                            codes: v_codes,
                            dataIndeces: null,
                            dimIndeces: t_dimIndeces,
                        };
                    }else{
                        t_dimIndeces = [];
                        let t_arr = new Array(),
                            t_indeces = new Array(),
                            t_dims = v_dimCover,
                            t_changed = false;
                        for(let i = 0; i < v_codes.length; i++){
                            let t_code = v_codes[i], t_fit = true;
                            for(let j = 0; j < t_dims.length; j++){
                                let t_dim = t_dims[j];
                                if(t_dim < 0 || !t_fit){
                                    continue;
                                }else{
                                    if(t_code[j] != t_dim){
                                        t_fit = false;
                                    }
                                }
                            }
                            if(t_fit){
                                t_indeces.push(i);
                                let t_newCode = [];
                                for(let j = 0; j < t_dims.length; j++){
                                    let t_dim = t_dims[j];
                                    if(t_dim < 0){
                                        if(!t_changed){
                                            t_dimIndeces[t_newCode.length] = j;
                                        }
                                        t_newCode.push(t_code[j]);
                                    }
                                }
                                if(!t_changed){
                                    t_changed = true;
                                }
                                t_arr.push(t_newCode);
                            }
                        }
                        return {
                            codes: t_arr,
                            dataIndeces: t_indeces,
                            dimIndeces: t_dimIndeces,
                        };
                    }
                };
                let t_dimCover = this.zoomed?this.dimCover:null;
                this.fCodes = t_filterCodes(this.collection.subIndex, t_dimCover);
                this.fMatrix = t_filterMatrix(this.collection.subIndex, this.fCodes.dataIndeces);
                let t_dimCount = this.collection.dimCount;
                this.informOthers("SubMapCollectionView__DimensionFiltering", {
                    dimCover: t_dimCover,
                    codeLength: t_dimCount,
                });
            },

            updateMapTrans: function(v_newIndeces){
                let t_mapTrans = this.mapTransition,
                    t_oldIndeces = t_mapTrans.indeces,
                    t_ovlLength = this.ovlDataLength;
                if(v_newIndeces == null){
                    let t_nameBook = new Map();
                    for(let i = 0; i < t_ovlLength; i++){
                        t_nameBook.set(i, i);
                    }
                    t_mapTrans.nameBook = t_nameBook;
                    if(t_oldIndeces != null){
                        let t_newMap = new Map();
                        for(let i = 0; i < t_oldIndeces.length; i++){
                            t_newMap.set(i, t_oldIndeces[i]);
                        }
                        t_mapTrans.tranIndeces = t_newMap;
                    }
                }else{
                    let t_newMap = new Map(),
                        t_nameBook = t_mapTrans.nameBook;
                    for(let i = 0; i < v_newIndeces.length; i++){
                        t_newMap.set(v_newIndeces[i], i);
                    }
                    for(let i = 0; i < t_ovlLength; i++){
                        if(t_newMap.has(i)){
                            t_nameBook.set(i, t_newMap.get(i));
                        }else{
                            t_nameBook.set(i, null);
                        }
                    }
                    if(t_oldIndeces == null){
                        t_mapTrans.tranIndeces = t_newMap;
                    }else{
                        let t_tranMap = new Map();
                        for(let i = 0; i < t_oldIndeces.length; i++){
                            let t_origInd = t_oldIndeces[i];
                            if(t_newMap.has(t_origInd)){
                                t_tranMap.set(i, t_newMap.get(t_origInd));
                            }
                        }
                        t_mapTrans.tranIndeces = t_tranMap;
                    }
                }
                t_mapTrans.indeces = v_newIndeces;
            },

            coloring: function(v_df){
                let t_df = $.Deferred(),
                    t_filterMat = this.fMatrix,
                    t_distMat = t_filterMat.distMat,
                    t_colors = t_filterMat.colors;
                if(this.zoomed){
                    this.collection.getColors(t_df, t_distMat);
                }else{
                    t_df.resolve(t_colors);
                }
                $.when(t_df).done((v_colors) => {
                    this.currentColors = v_colors;
                    v_df.resolve();
                });
            },

            clustering: function(v_df){
                let t_prepareCls = () => {
                    let t_distType = Config.get("clusterDistMat"),
                        t_proj = this.currentColors,
                        t_projDist;
                    switch(t_distType){
                        case "projection":
                            let t_length = t_proj.length;
                            t_projDist = Basic.initArray(t_length, t_length);
                            for(let i = 0; i < t_length - 1; i++){
                                for(let j = i+1; j < t_length; j++){
                                    t_projDist[i][j] = t_projDist[j][i] = Basic.getDistance(t_proj[i], t_proj[j]);
                                }
                            }
                        break;
                        case "original":
                            t_projDist = null;
                        break;
                    };
                    return [t_proj.length, t_projDist];
                }, t_storeCls = (v_clusters, v_level) => {
                        this.currentCls = {
                            clusters: v_clusters,
                            level: v_level,
                            paths: null,
                            aggregate: null,
                        };
                        this.aggregate();
                };
                let t_df = $.Deferred(),
                    t_distMat = this.fMatrix.distMat;
                if(this.zoomed){
                    let t_parameters = t_prepareCls();
                    this.currentCls = new Object();
                    this.collection.getSubHierClusters(t_df, true, ...t_parameters);
                }else{
                    t_df.resolve();
                }
                $.when(t_df).done((v_clusters, v_level) => {
                    if(!this.zoomed){
                        if(this.overallCls.clusters == null){
                            t_storeCls(this.collection.clusters, this.collection.clusterLevel);
                            this.overallCls = this.currentCls;
                        }else{
                            this.currentCls = this.overallCls;
                        }
                        v_df.resolve();
                    }else{
                        t_storeCls(v_clusters, v_level);
                        v_df.resolve();
                    }
                });
            },

            getClsByIDs: function(v_clsIDs, v_getIndeces = true){
                let t_indeces = this.fCodes.dataIndeces,
                    t_level = v_clsIDs.length - 1,
                    t_pathLevel = this.currentCls.paths[t_level],
                    t_prevCode = v_clsIDs.slice(0, v_clsIDs.length - 1).join("_"),
                    t_selfID = v_clsIDs[v_clsIDs.length - 1],
                    t_ids = t_pathLevel.filter((v_clsPath) => {
                        if(v_clsPath.outlier){
                            return false;
                        }
                        let t_code = v_clsPath.previous.join("_");
                        return t_code == t_prevCode;
                    })[0].ids[t_selfID];
                if(v_getIndeces && t_indeces != null){
                    let tt_ids = new Array(t_ids.length);
                    for(let i = 0; i < t_ids.length; i++){
                        tt_ids[i] = t_indeces[t_ids[i]] + "";
                    }
                    t_ids = tt_ids;
                }else{
                    for(let i = 0; i < t_ids.length; i++){
                        t_ids[i] = t_ids[i] + "";
                    }
                }
                return t_ids;
            },

            getDimCoverage: function(v_ids){
                let t_coverage = this.collection.getCoverage(v_ids);
                this.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__updateDimCoverage", data: t_coverage});
            },

            initVisible: function(v_center, v_ringDiameter, v_glyphSize, v_clsLevel, v_colors){
                class visibleObj{
                    constructor(v_this, v_center, v_ringDiameter, v_glyphSize, v_clsLevel, v_colors){
                        let t_extent = [1, Math.sqrt(v_clsLevel) + 1],
                            t_maxLevel =  Math.log(Math.pow(t_extent[1], 4))/Math.log(2),
                            t_zoomer = d3.behavior.zoom()
                            .translate([0, 0])
                            .scale(1)
                            .scaleExtent(t_extent)
                            .on("zoom", (e) => {
                                let t_trans = d3.event.translate,
                                    t_scale = d3.event.scale;
                                d3.select(".SubMapTiling")
                                .attr("transform", "translate(" + t_trans + ")scale(" + t_scale + ")");
                                this.update(t_trans, t_scale);
                            }),
                            t_ctr = t_maxLevel / v_clsLevel;
                        this.center = v_center;
                        this.diameter = v_ringDiameter;
                        this.glyphSize = v_glyphSize;
                        this.clsLevel = v_clsLevel;
                        this.colors = v_colors;
                        this.parent = v_this;
                        this.zoom = {
                            extent: t_extent,
                            maxLevel: t_maxLevel,
                            zoomer: t_zoomer,
                        };
                        this.container = null;
                        this.ctr = t_ctr;
                        this.clsToScale = (v_clsLevel) => {
                            return Math.pow(Math.pow(2, v_clsLevel * t_ctr), 0.25);
                        };
                    };
                    update(v_trans, v_scale, v_duration = t_duration){
                        let t_level = Math.log(Math.pow(v_scale, 4))/Math.log(2),
                            t_ctr = this.ctr,
                            t_div = t_ctr * 0.5,
                            t_this = this.parent,
                            t_c2scale = t_this.clsToScale,
                            t_clsPaths = t_this.currentCls.paths,
                            t_scales = t_this.scales,
                            t_ringRRatio = t_this.snapshotPar.ringRRatio,
                            t_transform = BasicView.getTransform(t_this.d3el.select(".SubMapTiling").attr("transform"));
                        let t_pointVisible = (v_pos) => {
                            v_pos[0] = v_pos[0] * v_scale - this.center[0] + v_trans[0];
                            v_pos[1] = v_pos[1] * v_scale - this.center[1] + v_trans[1];
                            let t_pr = Math.sqrt(v_pos[0] * v_pos[0] + v_pos[1] * v_pos[1]);
                            return t_pr + this.glyphSize * v_scale <= this.diameter * t_ringRRatio - 8 * 0.9;
                        }, t_changeVisible = (v_selection, v_visibleFunc, v_givenOpc = false) => {
                            v_selection
                            .interrupt()
                            .transition()
                            .duration(v_duration)
                            .attr("opacity", function(v_d, v_i){
                                let t_visible = v_visibleFunc(this);
                                if(t_visible){
                                    d3.select(this).classed("visible", true);
                                    if(v_givenOpc){
                                        return t_visible;
                                    }else{
                                        return 1;
                                    }
                                }else{
                                    d3.select(this).classed("visible", false);
                                    return 0;
                                }
                            });
                        }, t_SubClsVisible = (v_baseLineFunc) => {
                            let t_clsVisibleFunc = (v_gCls) => {
                                let t_visible;
                                if(!d3.select(v_gCls).classed("Outliers")){
                                    let t_clsID = d3.select(v_gCls).attr("clsID").split("_"),
                                        t_baseline = (t_clsID.length - 1) * t_ctr;
                                    t_visible = (t_level >= t_baseline - t_div && t_level < t_baseline + t_div);
                                    t_clsVisible[t_clsID.length - 1].atLevel = t_visible;
                                }else{
                                    let t_baseline = (this.clsLevel - 1) * t_ctr;
                                    t_visible = (t_level < (t_baseline + t_div));
                                }
                                return t_visible;
                            };
                            let t_Cls = t_this.d3el.selectAll(".SubMapClusters");
                            t_changeVisible(t_Cls, t_clsVisibleFunc);
                            t_this.d3el.selectAll(".visible .SubClsPath")
                            .each(function(v_path){
                                let t_pos = d3.select(this).attr("pos").split("_"),
                                    t_lineVisible = t_pointVisible(t_pos[0].split(",")) && t_pointVisible(t_pos[1].split(","));
                                d3.select(this)
                                .attr("display", t_lineVisible?"block":"none");
                            });
                        }, t_SubGlyphVisible = () => {
                            let t_glyphVisibleFunc = (v_gCls) => {
                                let t_baseline = this.clsLevel * t_ctr;
                                if(t_level >= t_baseline - t_div && t_level < t_baseline + t_div){
                                    let t_originOpc = t_this.pattern?parseFloat(d3.select(v_gCls).attr("ptOpacity")):1.0;
                                    return (t_div - Math.abs(t_level - t_baseline)) / t_div * t_originOpc;
                                }else{
                                    return false;
                                }
                            };
                            let t_Cls = t_this.d3el.selectAll(".dimFan");
                            t_changeVisible(t_Cls, t_glyphVisibleFunc, true);
                        }, t_SubGridVisible = () => {
                            let t_visible = new Set(), invisible = false;
                            t_this.d3el.selectAll(".SubMapGrids")
                            .classed("visible", false)
                            .classed("invisible", true)
                            .interrupt()
                            .transition()
                            .duration(v_duration)
                            .attr("opacity", 0);
                            let t_dictionary = t_clsVisible.dictionary,
                                t_visible_gs = 
                                t_this.d3el.selectAll(".SubMapGrids")
                                .filter(function(v_grid){
                                    let t_pos = d3.select(this).attr("position").split("_"),
                                        t_isVisible = t_pointVisible(t_pos),
                                        t_id = v_grid.id;
                                        if(t_isVisible && t_id != null){
                                            t_visible.add(t_id);
                                            let t_glbPos = Basic.scale(t_scales, v_grid.pos),
                                                tt_scale = t_transform.scale,
                                                tt_trans = t_transform.translate;
                                            if(t_transform.scaleFirst){
                                                t_glbPos[0] = (t_glbPos[0] * tt_scale) + tt_trans[0];
                                                t_glbPos[1] = (t_glbPos[1] * tt_scale) + tt_trans[1];
                                            }else{
                                                t_glbPos[0] = (t_glbPos[0] + tt_trans[0]) * tt_scale;
                                                t_glbPos[1] = (t_glbPos[1] + tt_trans[1]) * tt_scale;
                                            }
                                            t_clsVisible.update(v_grid.id, t_this.colors[v_grid.id], t_glbPos);
                                        }
                                        if(!t_isVisible && t_id != null){
                                            invisible = true;
                                        }
                                        return t_isVisible;
                                })
                                .attr("display", "block")
                                .classed("visible", true)
                                .classed("invisible", false);
                            t_visible_gs
                            .interrupt()
                            .transition()
                            .duration(v_duration)
                            .attr("opacity", function(){
                                let t_this = d3.select(this),
                                    t_zgOpc = parseFloat(t_this.attr("zgOpacity")),
                                    t_ftOpc = parseFloat(t_this.attr("ftOpacity")),
                                    t_ptOpc = parseFloat(t_this.attr("ptOpacity"));
                                t_zgOpc = isNaN(t_zgOpc)?1.0:t_zgOpc;
                                t_ftOpc = isNaN(t_ftOpc)?1.0:t_ftOpc;
                                t_ptOpc = isNaN(t_ptOpc)?1.0:t_ptOpc;
                                return t_zgOpc * t_ftOpc * t_ptOpc;
                            });
                            setTimeout(() => {
                                t_this.d3el.selectAll(".SubMapGrids.invisible")
                                .attr("display", "none");
                            })
                            if(invisible){
                                let t_colorMap = new Map(),
                                    t_changeColor = () => {
                                        t_visible = Basic.mapToArray(t_visible);
                                        if(t_visible.length > 0){
                                            let t_colors = Basic.scaleArray(Basic.subArray(this.colors, t_visible, [0,1,2]));
                                                t_visible_gs
                                                .selectAll(".metaGlyph.cell.fill")
                                                .filter(function(){return !d3.select($(this).parent()[0]).classed("empty")})
                                                .transition()
                                                .attr("fill", (v_grid) => {
                                                    if(v_grid.id == null){
                                                        return;
                                                    }
                                                    let t_id = t_visible.indexOf(v_grid.id), t_col = t_colors[t_id],
                                                        t_isCls = t_dictionary.has(v_grid.id);
                                                    if(t_isCls){
                                                        let t_index = t_dictionary.get(v_grid.id).join("_");
                                                        if(!t_colorMap.has(t_index)){
                                                            t_colorMap.set(t_index, [t_col]);
                                                        }else{
                                                            t_colorMap.get(t_index).push(t_col);
                                                        }
                                                    }
                                                    t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                                                    t_col = "rgb(" + t_col + ")";
                                                    return t_col;
                                                });
                                            t_clsVisible.updateColors(t_colorMap);
                                        }
                                    }
                                Basic.delay("changeColor", 400, t_changeColor);
                            }else{
                                let t_colorMap = new Map(),
                                    t_changeColor = () => {
                                        t_visible_gs
                                        .selectAll(".metaGlyph.cell.fill")
                                        .filter(function(){return !d3.select($(this).parent()[0]).classed("empty")})
                                        .transition()
                                        .duration(v_duration)
                                        .attr("fill", (v_grid) => {
                                            if(v_grid.id == null){
                                                return;
                                            }
                                            let t_col = this.colors[v_grid.id],
                                                t_isCls = t_dictionary.has(v_grid.id);
                                            if(t_isCls){
                                                let t_index = t_dictionary.get(v_grid.id).join("_");
                                                if(!t_colorMap.has(t_index)){
                                                    t_colorMap.set(t_index, [t_col]);
                                                }else{
                                                    t_colorMap.get(t_index).push(t_col);
                                                }
                                            }
                                            t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                                            t_col = "rgb(" + t_col + ")";
                                            return t_col;
                                        });
                                        t_clsVisible.updateColors(t_colorMap);
                                    }
                                Basic.delay("changeColor", 400, t_changeColor);
                            }
                        }, t_SubSnapshotVisible = (v_init) => {
                            let t_clsVisible = t_this.currentCls.visible;
                            if(v_init){
                                if(t_clsVisible == null){
                                    t_clsVisible = t_this.currentCls.visible = new Array();
                                    t_clsVisible.dictionary = new Map();
                                    let t_paths = t_this.currentCls.paths;
                                    for(let i = 0; i < t_paths.length; i++){
                                        let t_levelPaths = t_paths[i],
                                            t_levelVisible = new Array();
                                        t_levelVisible.atLevel = false;
                                        for(let j = 0; j < t_levelPaths.length; j++){
                                            let t_outlier = t_levelPaths[j].outlier;
                                            if(!t_outlier){
                                                let t_ids = t_levelPaths[j].ids;
                                                for(let k = 0; k < t_ids.length; k++){
                                                    t_levelVisible.push({
                                                        index: [j, k],
                                                        clsID: [...t_levelPaths[j].previous, k].join("_"),
                                                        visible: false,
                                                        positions: new Array(),
                                                        colors: new Array(),
                                                        avgPos: null,
                                                        avgCol: Basic.getMeanVector(Basic.subArray(this.colors, t_ids[k], [0,1,2]), false),
                                                        SShotAngle: 0,
                                                    });
                                                }
                                            }
                                        }
                                        t_clsVisible.push(t_levelVisible);
                                    }
                                    t_clsVisible.update = function(v_id, v_col, v_pos){
                                        let t_findFunc = (v_d) => {return v_d == v_id;};
                                        for(let i = 0; i < this.length; i++){
                                            if(!this[i].atLevel){
                                                continue;
                                            }
                                            let t_levelVisible = this[i], t_found = false,
                                                t_foundPath = new Array(), t_dictionary = this.dictionary;
                                            for(let j = 0; j < t_levelVisible.length; j++){
                                                let t_visibleItem = t_levelVisible[j],
                                                    t_index = t_visibleItem.index,
                                                    t_ids = t_clsPaths[i][t_index[0]].ids[t_index[1]],
                                                    t_id = t_ids.findIndex(t_findFunc);
                                                if(t_id >= 0){
                                                    t_visibleItem.visible = true;
                                                    t_visibleItem.positions.push(v_pos);
                                                    t_visibleItem.colors.push(v_col);
                                                    t_dictionary.set(v_id, [i,j]);
                                                    break;
                                                }
                                            }
                                        }
                                    };
                                    t_clsVisible.updateColors = function(v_colorsMap){
                                        let t_duration = t_this.transition.short;
                                        t_this.d3el.selectAll(".SubMapSShot")
                                        .filter(function(){
                                            let t_index = d3.select(this).attr("index"),
                                                t_return = false;
                                            if(v_colorsMap.has(t_index)){
                                                t_return = true;
                                                let t_col = Basic.getMeanVector(v_colorsMap.get(t_index), false);
                                                t_col = BasicView.colToRgb(t_col);
                                                // d3.select(this)
                                                // .selectAll(".SubMapSnapshot path")
                                                // .interrupt()
                                                // .transition()
                                                // .duration(400)
                                                // .attr("fill", t_col);
                                            }
                                            return t_return;
                                        });
                                    };
                                }else{
                                    t_clsVisible.dictionary = new Map();
                                    for(let i = 0; i < t_clsVisible.length; i++){
                                        let t_levelVisible = t_clsVisible[i];
                                        t_clsVisible[i].atLevel = false;
                                        for(let j = 0; j < t_levelVisible.length; j++){
                                            let t_levelVisibleItem = t_levelVisible[j];
                                            t_levelVisibleItem.visible = false;
                                            t_levelVisibleItem.avgPos = null;
                                            t_levelVisibleItem.avgCol = null;
                                            t_levelVisibleItem.sshotAngle = 0;
                                        }
                                    }
                                }
                            }else{
                                let t_center = this.center, t_angles = new Array(), t_PI = Math.PI,
                                    t_angInterval = (180 / t_this.snapshotPar.angInterval);
                                for(let i = 0; i < t_clsVisible.length; i++){
                                    let t_levelVisible = t_clsVisible[i];
                                    for(let j = 0; j < t_levelVisible.length; j++){
                                        let t_levelVisibleItem = t_levelVisible[j];
                                        if(t_levelVisibleItem.positions.length > 0){
                                            let t_avgPos = t_levelVisibleItem.avgPos
                                                = Basic.getMeanVector(t_levelVisibleItem.positions, false),
                                                t_angle = Basic.getAngle(t_center, t_avgPos);
                                            t_angle = Math.round(t_angle / t_PI * t_angInterval) * t_PI / t_angInterval;
                                            t_levelVisibleItem.positions = new Array();
                                            // t_angles.push({
                                            //     index: [i,j].join("_"), 
                                            //     angle: t_angle,
                                            // });
                                            t_levelVisibleItem.SShotAngle = t_angle;
                                        }
                                        if(t_levelVisibleItem.colors.length > 0){
                                            t_levelVisibleItem.avgCol = Basic.getMeanVector(t_levelVisibleItem.colors, false);
                                            t_levelVisibleItem.colors = new Array();
                                        }
                                    }
                                    // t_angles.sort((v_a, v_b) => {return v_a.angle - v_b.angle;});
                                    // let t_div = t_angles.length == 0?0:(Math.PI * 2 / t_angles.length);
                                    // for(let i = 0; i < t_angles.length; i++){
                                    //     let t_index = t_angles[i].index.split("_");
                                    //     t_clsVisible[t_index[0]][t_index[1]].SShotAngle = 
                                    // }
                                }
                                // t_this.showSnapshot();
                            }
                            return t_clsVisible;
                        }, t_clsVisible = t_SubSnapshotVisible(true);
                        t_SubClsVisible();
                        t_SubGlyphVisible();
                        t_SubGridVisible();
                        t_SubSnapshotVisible();
                        t_this.updateClusterInfo(false);
                    };
                    toLevel(v_center, v_level, v_duration){
                        let t_scale = this.clsToScale(v_level),
                            t_trans = [- v_center[0] * t_scale, - v_center[1] * t_scale],
                            t_newTransform = "translate(" + t_trans + ")scale(" + t_scale + ")",
                            t_zoomer = this.zoom.zoomer,
                            t_oldTrans = t_zoomer.translate(),
                            t_oldScale = t_zoomer.scale(),
                            t_oldTransform = "translate(" + t_oldTrans + ")scale(" + t_oldScale + ")",
                            t_tolerance = this.parent.sizeTolr,
                            t_needToChange = true;
                        if(Math.abs(t_trans[0] - t_oldTrans[0]) < t_tolerance && 
                            Math.abs(t_trans[1] - t_oldTrans[1]) < t_tolerance && 
                            Math.abs(t_scale - t_oldScale) < Number.EPSILON * 1000){
                            t_needToChange = false;
                        }
                        if(!t_needToChange){
                            return 0;
                        }
                        this.zoom.zoomer.translate(t_trans).scale(t_scale);
                        this.container.transition()
                        .duration(v_duration)
                        .attrTween("transform", () => {return d3.interpolate(t_oldTransform, t_newTransform);});
                        if(t_scale > t_oldScale){
                            this.update(t_trans, t_scale, v_duration);
                        }else{
                            setTimeout(() => {
                                this.update(t_trans, t_scale, v_duration)
                            }, v_duration);
                        }
                        return v_duration;
                    };
                    prepareContainer(v_g){
                        let t_g = this.container = v_g
                            .call(this.zoom.zoomer)
                            .on("dblclick.zoom", null)
                            .append("g")
                            .attr("class","SubMapTiling");
                        return t_g;
                    };
                };
                let t_duration = this.transition.duration;
                return new visibleObj(this, v_center, v_ringDiameter, v_glyphSize, v_clsLevel, v_colors);
            },

            showTiling: function(v_df){
                let t_this = this;
                let t_renderMap = (v_df, v_g, v_glyphSize, v_colors) => {
                    let t_makeNewMap = (v_duration) => {
                        SubGlyph.init(v_glyphSize, v_glyphSize, Config.get("mapType"), Config.get("glyphType"), v_colors);
                        let t_g = v_g.selectAll(".SubMapGridRows")
                            .data(t_grids)
                            .enter()
                            .append("g")
                            .attr("class", "SubMapGridRows")
                            .selectAll(".SubMapGrids")
                            .data(v_d => {return v_d;})
                            .enter()
                            .append("g")
                            .attr("class", "SubMapGrids")
                            .attr("index", v_grid => {
                                if(v_grid.id == null){
                                    return -1;
                                }else{
                                    if(t_indeces == null){
                                        return v_grid.id;
                                    }else{
                                        return t_indeces[v_grid.id];
                                    }
                                }
                            })
                            .attr("gSize", v_glyphSize)
                            .classed("empty", v_grid => {
                                return (v_grid.id==null)?true:false;
                            })
                            .attr("position", v_grid => {
                                let t_pos = Basic.scale(t_scales, v_grid.pos);
                                return t_pos.join("_");
                            })
                            .attr("transform", v_grid => {
                                return "translate(" + Basic.scale(t_scales, v_grid.pos) + ")";
                            })
                        this.d3el.selectAll(".SubMapTiling")
                        .attr("opacity", 0)
                        .transition()
                        .duration(v_duration)
                        .attr("opacity", 1);
                            // .attr("fill-opacity", v_grid => {
                            //     if(v_grid.id == null){
                            //         return;
                            //     }
                            //     let t_code = v_grid.code.join(""),
                            //         t_count = this.aggregate.get(t_code);
                            //     return t_aggrScale(t_count);
                            // });
                        t_g.call(function(v_gs){
                            v_gs.forEach(vv_gs => {
                                vv_gs.forEach(vvv_gs => {
                                    let tt_grid = d3.select(vvv_gs).data()[0], t_pid = tt_grid.id, t_col, t_code = tt_grid.code;
                                    if(t_pid != null){
                                        // t_col = d3.hsl(t_colorScale(v_colors[t_pid][2]), 1.0, 0.4).toString();
                                        t_col = v_colors[t_pid];
                                        t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                                        t_col = "rgb(" + t_col + ")";
                                    }else{
                                        t_col = "#fff";
                                    }
                                    let tt_nghIDs, t_sPos = tt_grid.pos, tt_div;
                                    switch(Config.get("gridType")){
                                        case "hexagon":
                                            tt_div = Math.PI * 2 / 6;
                                            tt_nghIDs = new Array(6);
                                            for(let i = 0; i < 6; i++){
                                                tt_nghIDs[i] = {
                                                    angle: tt_div * i,
                                                    diff: null,
                                                    dist: null,
                                                };
                                            }
                                            tt_nghIDs.diffScale = t_diffScale;
                                        break;
                                    }
                                    if(t_pid!=null){
                                        tt_grid.gridNeighbors.forEach(v_ngh => {
                                            let t_ngh = t_grids[v_ngh[0]][v_ngh[1]],
                                                tt_id = t_ngh.id,
                                                tt_dist, tt_diff,
                                                t_nPos = t_ngh.pos,
                                                t_divPos = [t_nPos[0] - t_sPos[0], t_nPos[1] - t_sPos[1]],
                                                t_angle;
                                            if(tt_id!=null){
                                                tt_dist = t_distMat[t_pid][tt_id];
                                                tt_diff = t_diffMat[t_pid][tt_id];
                                                if(Math.abs(t_divPos[0]) < Number.EPSILON){
                                                    if(t_nPos[1] > t_sPos[1]){
                                                        t_angle = Math.PI / 2;
                                                    }else{
                                                        t_angle = - Math.PI / 2;
                                                    }
                                                }else{
                                                    let t_tan = t_divPos[1]/t_divPos[0];
                                                    t_angle = Math.atan(t_tan);
                                                    if(t_tan < 0){
                                                        if(t_divPos[1] > 0){
                                                            t_angle += Math.PI;
                                                        }else{
                                                            t_angle += Math.PI * 2;
                                                        }
                                                    }else{
                                                        if(t_tan > 0){
                                                            if(t_divPos[1] < 0){
                                                                t_angle += Math.PI;
                                                            }
                                                        }else{
                                                            if(t_tan == 0){
                                                                if(t_divPos[0] > 0){
                                                                    t_angle = 0;
                                                                }else{
                                                                    t_angle = Math.PI;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                let t_number = Math.round(t_angle / tt_div);
                                                tt_nghIDs[t_number].dist = t_nghScale(tt_dist);
                                                tt_nghIDs[t_number].diff = tt_diff;
                                            }
                                        });
                                    }
                                    let t_weights = (t_pid == null)?null:t_nghDims[t_pid],
                                        t_parameters = [d3.select(vvv_gs), tt_nghIDs, t_pid, t_codes[t_pid], t_col, this.pattern, t_weights, t_nghDimExt];
                                    if(t_pid == null){
                                        t_renderEmpty.add(t_parameters);
                                    }else{
                                        t_renderGrids.add(t_parameters);
                                    }
                                });
                            });
                        });
                        t_renderEmpty.forEach(v_emptyPmt => {
                            let t_g = SubGlyph.showGlyph(...v_emptyPmt);
                        });
                        t_renderGrids.forEach(v_gridPmt => {
                            let t_g = SubGlyph.showGlyph(...v_gridPmt);
                            t_g.on("click", function(v_point){
                                if(v_point.id == null){
                                    return;
                                }
                                t_interactions.pinning(this, false);
                            })
                        });
                    },  t_hideOldMap = (v_df) => {
                        let t_time = this.visible.toLevel([0,0], 0, t_longDuration), t_df = $.Deferred();
                        setTimeout(()=>{
                            t_df.resolve();
                        }, t_time);
                        $.when(t_df).done(() => {
                            let t_midDuration = 0,
                                t_endDuration = 0;
                            if(!this.isNew){
                                t_midDuration = t_longDuration * 0.5;
                                t_endDuration = t_longDuration;
                                this.hideClusters(true, t_midDuration);
                                // this.hideSnapshot(true, t_midDuration);
                                // this.hideRings(true, t_midDuration);
                                setTimeout(() => {
                                    this.moveGrids(t_grids, t_scales, v_colors, v_glyphSize, t_endDuration);
                                }, 300);
                            }
                            setTimeout(() => {
                                v_df.resolve(t_midDuration);
                            }, t_endDuration * 0.8);
                        });
                    };
                    let t_renderEmpty = new Set(), t_renderGrids = new Set(),
                        t_nghDims = this.nghDims, t_nghDimExt = t_nghDims.extent,
                        t_nghScale = d3.scale.linear().domain([t_distExt.min, t_distExt.max]).range([0, 0.8]),
                        t_diffScale = d3.scale.linear().domain([1, t_codeLength]).range([0, v_glyphSize * Math.sqrt(3) * 2 / 3]),
                        t_isTrans = !this.isNew,
                        t_df = $.Deferred();
                    t_hideOldMap(t_df);
                    $.when(t_df).done((v_duration)=>{
                        t_makeNewMap(v_duration);
                        v_df.resolve();
                    });
                };
                let t_interactions = this.interactions,
                    t_filterCodes = this.fCodes,
                    t_codes = t_filterCodes.codes,
                    t_indeces = t_filterCodes.dataIndeces,
                    t_dimIndeces = t_filterCodes.dimIndeces,
                    t_dataLength = t_codes.length,
                    t_codeLength = t_codes[0].length,
                    t_filterMat = this.fMatrix,
                    t_nghList = t_filterMat.neighbors,
                    t_distMat = t_filterMat.distMat,
                    t_diffMat = t_filterMat.diffMat,
                    t_distExt = t_filterMat.distExt,
                    t_colors = this.currentColors,
                    t_scales = this.scales,
                    t_map, t_grids, t_edges,
                    t_longDuration = this.transition.long,
                    t_shortDuration = this.transition.duration,
                    t_mapChanged = (!this.newData) || this.zoomed;
                    // t_aggrRange = this.aggregate(t_codes, t_nghList);
                // let t_aggrScale = d3.scale.linear().domain(t_aggrRange).range([0,1]);
                if(!this.zoomed && this.overallMap != null){
                    t_map = this.overallMap;
                }else{
                    t_map = Tiling.getMap(t_nghList, t_distMat, t_codes, Config.get("gridType"), Config.get("gridScaling"));
                    if(!this.zoomed){
                        this.overallMap = t_map;
                    }
                }
                if(typeof(t_map) === "string"){
                    //failed
                    throw "ERROR: " + t_map;
                    return;
                }
                t_grids = t_map.grids;
                t_edges = t_map.edges;
                if(!this.freeDim){
                    this.freeDim = t_codeLength;
                }
                let t_centerID = t_grids.getCenterPID(),
                    t_colorScale = d3.scale.linear().domain([0,1]).range([45, 315]);//hue channel
                if(this.zoomed){
                    let t_subColors = Basic.subArray(this.colors, t_indeces, [0,1,2]);
                    t_colors = SubRotate.groupMoveTo(t_colors, t_subColors);//rgb color;
                }else{
                    if(!this.colorFixed){
                        this.colors = SubRotate.pointMoveTo(t_colors, t_centerID, Config.get("centerColor"));//rgb color;
                        this.colorFixed = true;
                    }
                    t_colors = this.colors;
                }
                this.informOthers("SubMapCollectionView__UpdateMap",
                {
                    mapChanged: t_mapChanged,
                    colors: t_mapChanged?t_colors:this.colors,
                    clusters: this.currentCls.clusters,
                    selections: null,
                    codes: t_codes,
                    dimensions: this.collection.dimensions,
                    dimIndeces: t_dimIndeces,
                    dataIndeces: t_indeces,
                });
                this.newData = false;
                let t_center = [(t_scales.x.range()[1] + t_scales.x.range()[0]) * 0.5,
                            (t_scales.y.range()[1] + t_scales.y.range()[0]) * 0.5],
                    t_dRing = [(t_scales.x.range()[1] - t_scales.x.range()[0]),
                            (t_scales.y.range()[1] - t_scales.y.range()[0])],
                    t_rSize =  t_dRing[0] * 0.5 / t_grids.radius,
                    t_clsLevel = this.currentCls.level,
                    t_dfResetZoom = $.Deferred(),
                    t_dfHdlOldMap = $.Deferred(), t_g;
                if(!this.isNew){
                    let t_time = this.visible.toLevel([0,0], 0, t_shortDuration);
                    setTimeout(()=>{
                        t_dfResetZoom.resolve();
                    }, t_time);
                }else{
                    t_dfResetZoom.resolve();
                }
                $.when(t_dfResetZoom).done(() => {
                    this.d3el.select(".SubMapTiling").classed("SubMapTiling", false).classed("SubOldTiling", true);
                    this.visible = this.initVisible(t_center, t_dRing[0], t_rSize, t_clsLevel, t_colors);
                    t_g = this.visible.prepareContainer(this.d3el);
                    t_renderMap(t_dfHdlOldMap, t_g, t_rSize, t_colors);
                });
                $.when(t_dfHdlOldMap).done(() => {
                    this.showClusters(t_map, t_scales);
                    this.visible.update([0,0], 1.0);
                    this.clsColorReady = true;
                    this.updateClusterInfo();
                    this.isNew = false;
                    v_df.resolve();
                });
            },

            hideClusters: function(v_delete, v_duration, v_show = false){
                if(v_delete){
                    this.d3el.selectAll(".SubMapClusters")
                    .classed("SubMapClusters", false)
                    .classed("SubOldClusters", true)
                    .attr("opacity", function(){
                        let t_opc = d3.select(this).attr("opacity");
                        return (t_opc == null)?0.5:t_opc;
                    })
                    .interrupt()
                    .transition()
                    .duration(v_duration)
                    .attr("opacity", 0)
                    .remove();
                }else{
                    if(v_show){
                        // show cluster map
                    }else{
                        setTimeout(() => {
                            this.d3el.selectAll(".SubMapClusters")
                            .attr("display", "none");
                        }, durationLong);
                    }
                }
            },

            hideSnapshot: function(v_delete, v_duration){
                BasicView.hide("SShotHider", this.d3el.selectAll(".SubMapSShots"), v_duration, true, true);
            },

            hideRings: function(v_delete, v_duration, v_show = false){
                if(v_delete){
                    this.d3el.selectAll(".SubMapRings")
                    .classed("SubMapRings", false)
                    .classed("SubOldRings", true)
                    .attr("opacity", function(){
                        let t_opc = d3.select(this).attr("opacity");
                        return (t_opc == null)?1.0:t_opc;
                    })
                    .interrupt()
                    .transition()
                    .duration(v_duration)
                    .attr("opacity", 0)
                    .remove();
                }else{
                    if(v_show){
                        // show cluster map
                    }else{
                        setTimeout(() => {
                            this.d3el.selectAll(".SubMapClusters")
                            .attr("display", "none");
                        }, durationLong);
                    }
                }
            },

            moveGrids: function(v_grids, v_scales, v_colors, v_glyphSize, v_duration){
                let t_transIndeces = this.mapTransition.tranIndeces;
                this.d3el.selectAll(".SubMapGridRows")
                .classed("SubMapGridRows", false)
                .classed("SubOldRows", true);
                this.d3el.selectAll(".SubMapGrids")
                .classed("SubMapGrids", false)
                .classed("SubOldGrids", true);
                this.d3el.selectAll(".SubOldGrids")
                .filter(function(v_d){
                    let t_id = parseInt(v_d.id);
                    if(t_transIndeces.has(t_id)){
                        d3.select(this).classed("match", true);
                        return false;
                    }else{
                        let t_opc = d3.select(this).attr("opacity");
                        if(t_opc == null){
                            d3.select(this).attr("opacity", 0.2);
                        }
                        return true;
                    }
                })
                .interrupt()
                .transition()
                .duration(v_duration)
                .attr("opacity", 0)
                .remove();
                let t_origGlyphSize = parseFloat(this.d3el.select(".SubOldGrids.match").attr("gSize")),
                    t_zoomScale = v_glyphSize / t_origGlyphSize;
                this.d3el.selectAll(".SubOldGrids.match")
                .interrupt()
                .transition()
                .duration(v_duration)
                .ease("linear")
                .attr("transform", function(v_d, v_i){
                    let t_oldID = parseInt(v_d.id),
                        t_newID = t_transIndeces.get(t_oldID),
                        t_cords = v_grids.findGridByID(t_newID),
                        t_grid = v_grids[t_cords[0]][t_cords[1]],
                        t_pos = Basic.scale(v_scales, t_grid.pos),
                        t_col = v_colors[t_newID];
                    t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                    t_col = "rgb(" + t_col + ")";
                    d3.select(this).select("path")
                    .interrupt()
                    .transition()
                    .duration(v_duration)
                    .attr("fill", t_col);
                    return "translate(" + t_pos + ")scale(" + t_zoomScale + ")";
                })
                .attr("opacity", 0)
                .remove();
                setTimeout(() => {
                    this.d3el.selectAll(".SubOldTiling").remove();
                }, v_duration + 20);
            },

            showClusters: function(v_map, v_scales){
                let t_getPathTree = (v_cls, v_paths, v_currentLevel, v_prev, v_id) => {
                    let t_cls = new Array(),
                        t_out = new Array(),
                        t_returnCls = new Array();
                    for(let i = 0; i < v_cls.length; i++){
                        if(v_cls[i].length != null){
                            let t_simpleCls,
                            t_prev = v_prev.slice(0);
                            t_prev.push(i);
                            t_simpleCls = t_getPathTree(v_cls[i], v_paths, v_currentLevel + 1, t_prev, i);
                            t_cls.push(t_simpleCls);
                            t_returnCls.push(...t_simpleCls);
                        }else{
                            t_returnCls.push(v_cls[i]);
                            t_out.push(v_cls[i]);
                        }
                    }
                    if(t_cls.length > 0){
                        let t_paths = Tiling.getGridClusters(v_map, t_cls);
                        v_paths[v_currentLevel].push({
                            previous: v_prev,
                            selfID: v_id + "",
                            paths: t_paths,
                            ids: t_cls,
                            outlier: false,
                        });
                    }
                    if(v_currentLevel < v_paths.length && t_out.length > 0){
                        t_out = [t_out];
                        let t_outPaths = Tiling.getGridClusters(v_map, t_out);
                        v_paths[v_currentLevel].push({
                            previous: v_prev,
                            selfID: v_id + "",
                            paths: t_outPaths,
                            ids: t_out,
                            outlier: (t_cls.length > 0),
                        });
                    }
                    return t_returnCls;
                },  t_renderPaths = (v_clsPaths, v_classNames, v_prev, v_isOut) => {
                    let t_clsLevel = v_prev.length,
                        t_cls = this.d3el.select(".SubMapTiling")
                        .selectAll("." + v_classNames)
                        .data(v_clsPaths)
                        .enter()
                        .append("g")
                        .attr("class", (v_d, v_i) => {
                            let t_extra = (v_isOut)?" Outliers":"";
                            return "SubMapClusters " + v_classNames + "_" + v_i + t_extra;
                        })
                        .attr("clsID", (v_d, v_i) => {
                            return [...v_prev, v_i].join("_");
                        })
                        .attr("fill-opacity", 0.0)
                        .on("mouseover", function(v_d, v_i){
                            let t_clsID = d3.select(this).attr("clsID");
                            if(t_interactions.hoveredID != t_clsID){
                                t_interactions.hoveredID = t_clsID;
                                t_interactions.mouseOver(this, v_isOut);
                            }
                        })
                        .on("mouseout", (v_d, v_i) => {
                                t_interactions.hoveredID = null;
                                t_interactions.mouseOut(v_isOut);
                        })
                        .on("click", function(v_d, v_i){
                            Basic.delay("clickPinning", 400, () => {
                                t_interactions.pinning(this);
                            });
                        })
                        .on("dblclick", (v_d, v_i) => {
                            Basic.clearDelay("clickPinning");
                            if(!v_isOut){
                                this.visible.toLevel(v_d.center, v_d.clsLevel + 1, this.transition.long);
                            }
                        });
                    t_cls.call(v_gs => {
                        v_gs[0].forEach(v_g => {
                            let t_clusterPaths = d3.select(v_g).data()[0],
                                t_paths = new Array(),
                                t_lines = new Array(),
                                t_rangePath = new Array(),
                                t_rangePts, t_diameter = 0;
                            //draw block paths
                            for(let i = 0; i < t_clusterPaths.paths.length; i++){
                                let t_clusterPath = t_clusterPaths.paths[i],
                                    t_pt = Basic.scale(v_scales, t_clusterPath[0]),
                                    t_path = "M" + t_pt;
                                for(let j = 1; j < t_clusterPath.length; j++){
                                    let t_pt_j = Basic.scale(v_scales, t_clusterPath[j]);
                                    t_path += " L" + t_pt_j;
                                    t_rangePath.push(t_pt_j);
                                }
                                t_paths.push(t_path);
                            }
                            for(let i = 0; i < t_rangePath.length - 1; i++){
                                for(let j = i+1; j < t_rangePath.length; j++){
                                    let t_dist = Basic.getDistance(t_rangePath[i], t_rangePath[j]);
                                    if(t_dist > t_diameter){
                                        t_diameter = t_dist;
                                        t_rangePts = [i,j];
                                    }
                                }
                            }
                            for(let i = 0; i < t_rangePts.length; i++){
                                t_rangePts[i] = t_rangePath[t_rangePts[i]];
                            }
                            t_clusterPaths.center = Basic.getMeanVector(t_rangePts, false);
                            t_clusterPaths.diameter = t_diameter;
                            t_clusterPaths.clsLevel = t_clsLevel;
                            d3.select(v_g)
                            .selectAll("path")
                            .data(t_paths)
                            .enter()
                            .append("path")
                            .attr("d", (vv_path) => {return vv_path});                            
                            //draw edge lines
                            if(!d3.select(v_g).classed("Outliers")){
                                d3.select(v_g)
                                .append("g")
                                .attr("class", "SubClsPaths")
                                .selectAll(".SubClsPath")
                                .data(t_clusterPaths.lines)
                                .enter()
                                .append("g")
                                .attr("class", "SubClsPath")
                                .each(function(v_pathPoints, v_i){
                                    let t_start = Basic.scale(v_scales, v_pathPoints[0]),
                                        t_end = Basic.scale(v_scales, v_pathPoints[1]),
                                        t_line = [t_start, t_end].join("_");
                                    d3.select(this)
                                    .attr("pos", t_line)
                                    .selectAll("line")
                                    .data(v_pathPoints)
                                    .enter()
                                    .append("line")
                                    .attr("x1", (v_line) => {return t_start[0];})
                                    .attr("y1", (v_line) => {return t_start[1];})
                                    .attr("x2", (v_line) => {return t_end[0];})
                                    .attr("y2", (v_line) => {return t_end[1];})
                                    .attr("stroke", "#666");
                                });                                
                            }
                        });
                    })
                };
                let t_this = this, 
                    t_interactions = this.interactions,
                    t_clsPaths = new Array(),
                    t_levels = this.currentCls.level;
                if(!this.zoomed && this.overallCls.paths != null){
                    t_clsPaths = this.currentCls.paths;
                }else{
                    let t_cls = this.currentCls.clusters;
                    for(let i = 0; i < t_levels; i++){
                        t_clsPaths.push(new Array());
                    }
                    t_getPathTree(t_cls, t_clsPaths, 0, [], null);
                    this.currentCls.paths = t_clsPaths;
                }
                for(let i = t_clsPaths.length; i > 0; i--){
                    let t_clsLevel = t_clsPaths[i - 1];
                    for(let j = 0; j < t_clsLevel.length; j++){
                        let t_pathData = t_clsLevel[j],
                            t_paths = t_pathData.paths,
                            t_prev = t_pathData.previous,
                            t_isOut = t_pathData.outlier;
                        t_renderPaths(t_paths, "SubCls" + t_prev.join("_"), t_prev, t_isOut);
                    }
                }
                this.updateClusterInfo();
            },

            updateClusterInfo: function(v_init = true){
                if(!this.clsColorReady){
                    return;
                }
                if(v_init){
                    let t_initClsProjections = () => {
                        let t_centers = new Array(),
                            t_aggr = this.currentCls.aggregate,
                            t_tree = this.collection.subTree,
                            t_findCol = (v_clsIDs) => {
                                let t_visibleList = this.currentCls.visible[v_clsIDs.length - 1],
                                    t_clsID = v_clsIDs.join("_"),
                                    t_visibleItem = t_visibleList.filter((v_visibleItem)=>{
                                        return v_visibleItem.clsID == t_clsID;
                                    })[0];
                                return t_visibleItem.avgCol;
                            }, t_findWeight = (v_clsIDs) => {
                                let t_children = t_aggr;
                                for(let i = 0; i < v_clsIDs.length; i++){
                                    t_children = t_children[v_clsIDs[i]];
                                }
                                let t_weights = t_children.supernode.nghDims;
                                t_weights = numeric.div(t_weights, Math.max(...t_weights));
                                return t_weights;
                            };
                        let t_collection = this.collection;
                        this.d3el.selectAll(".SubMapClusters")
                        .each(function(t_d){
                            let t_this = d3.select(this),
                                t_outliers = t_this.classed("Outliers");
                            if(t_outliers){
                                return;
                            }
                            let t_clsID = t_this.attr("clsID").split("_"),
                                t_subTree = t_collection.subTree.findByIndex(t_clsID),
                                t_weights = t_subTree.data.dataWeights,
                                t_ovlWeights = (this.ovlDataWeights == undefined)?(t_collection.subTree.data.dataWeights):this.ovlDataWeights;
                            t_weights = numeric.sub(t_weights, t_ovlWeights);
                            let t_cid = t_clsID.length - 1,
                                t_info = {
                                    center: t_d.center,
                                    clsID: t_clsID,
                                    color: t_findCol(t_clsID),
                                    count: t_tree.findByIndex(t_clsID).dictionary.length,
                                    weights: t_findWeight(t_clsID),
                                    data: t_weights,
                                };
                            if(t_centers[t_cid] == undefined){
                                t_centers[t_cid] = [];
                            }
                            t_centers[t_cid].push(t_info);
                        });
                        this.informOthers("SubMapCollectionView__ShowClusters", t_centers);
                    }
                    t_initClsProjections();
                }else{
                    let t_updateClsProjections = () => {
                        let t_centers = new Array(),
                            t_aggr = this.currentCls.aggregate,
                            t_tree = this.collection.subTree,
                            t_findVisible = (v_clsIDs) => {
                                let t_visibleList = this.currentCls.visible[v_clsIDs.length - 1],
                                    t_clsID = v_clsIDs.join("_"),
                                    t_visibleItem = t_visibleList.filter((v_visibleItem)=>{
                                        return v_visibleItem.clsID == t_clsID;
                                    })[0];
                                return t_visibleItem.visible;
                            };
                        this.d3el.selectAll(".SubMapClusters")
                        .each(function(t_d){
                            let t_this = d3.select(this),
                                t_outliers = t_this.classed("Outliers");
                            if(t_outliers){
                                return;
                            }
                            let t_clsID = t_this.attr("clsID").split("_"),
                                t_cid = t_clsID.length - 1,
                                t_info = {
                                    clsID: t_this.attr("clsID"),
                                    visible: t_findVisible(t_clsID),
                                };
                            if(t_centers[t_cid] == undefined){
                                t_centers[t_cid] = [];
                            }
                            t_centers[t_cid].push(t_info);
                        });
                        this.informOthers("SubMapCollectionView__UpdateClusters", t_centers);
                    }
                    t_updateClsProjections();
                }
            },

            showSnapshot: function(){
                let t_clsTree = this.currentCls, t_clsVisible = this.currentCls.visible, t_visibleClusters = new Array();
                for(let i = 0; i < t_clsVisible.length; i++){
                    let t_levelVisible = t_clsVisible[i];
                    if(t_levelVisible.atLevel){
                        for(let j = 0; j < t_levelVisible.length; j++){
                            let t_visibleItem = t_levelVisible[j];
                            if(t_visibleItem.visible){
                                t_visibleClusters.push(t_visibleItem.clsID);
                            }
                        }
                    }
                }
                let t_this = this, t_d3 = this.d3el, t_snapshots = t_d3.selectAll(".SubMapSShot"), t_scales = this.scales,
                    t_dimNum = t_clsTree.aggregate.supernode.nghDims.length,
                    t_divAngle = 2 * Math.PI / t_dimNum;
                if(t_snapshots.empty()){
                    let t_par = this.snapshotPar,
                        t_anchorR = t_par.anchorR,
                        t_xRange = (t_scales.x.range()[1] - t_scales.x.range()[0]),
                        t_r = this.snapshotPar.ringR = t_xRange * t_par.ringRRatio,
                        t_sshotR = t_xRange * t_par.sshotRRatio,
                        t_margin = t_xRange * t_par.marginRatio,
                        t_clsPaths = new Array(),
                        t_g = t_d3.append("g")
                        .attr("class", "SubMapSShots")
                        .attr("transform", "translate(" + Basic.scale(t_scales, [0.5, 0.5]) + ")");
                    t_g.append("circle")
                    .attr("class", "SubMapSShotRing")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", t_r);
                    // t_d3.selectAll(".SubMapClusters").filter(function(){
                    //     let t_fit = (!d3.select(this).classed("Outliers"));
                    //     if(t_fit){
                    //         t_clsPaths.push(d3.select(this).attr("clsID"));
                    //     }
                    //     return t_fit;
                    // });
                    t_g.selectAll(".SubMapSShotLevel")
                        .data(t_clsVisible)
                        .enter()
                        .append("g")
                        .attr("class", "SubMapSShotLevel")
                        .each(function(v_visibleLevel, v_i){
                            let t_ssg = d3.select(this)
                            .selectAll(".SubMapSShot")
                            .data(v_visibleLevel)
                            .enter()
                            .append("g")
                            .attr("class", "SubMapSShot")
                            .attr("clsID", (v_visibleItem) => {
                                return v_visibleItem.clsID;
                            })
                            .attr("index", (v_item, v_j) => {
                                return v_i + "_" + v_j;
                            });
                            t_ssg
                            .append("circle")
                            .attr("class", "SubMapSSAnchor")
                            .attr("index", (v_visibleItem, v_j) => {
                                return v_j;
                            })
                            .attr("cx", (v_visibleItem) => {
                                if(v_visibleItem.avgPos != null){
                                    return v_visibleItem.avgPos[0];
                                }else{
                                    return 0;
                                }
                            })
                            .attr("cy", (v_visibleItem) => {
                                if(v_visibleItem.avgPos != null){
                                    return v_visibleItem.avgPos[1];
                                }else{
                                    return 0;
                                }
                            })
                            .attr("r", t_anchorR)
                            .style("visibility", "hidden");
                            let t_outR = t_par.outR = t_r + t_margin + t_sshotR,
                                t_interactions = t_this.interactions,
                                t_snapshot = t_ssg
                                .append("g")
                                .attr("class", "SubMapSnapshot")
                                .attr("opacity", 0.6)
                                .on("mouseover", function(v_visibleItem){
                                    let t_clsID = v_visibleItem.clsID;
                                    t_d3.selectAll(".SubMapClusters")
                                    .each(function(){
                                        if(d3.select(this).attr("clsID") == t_clsID){
                                            let t_isOut = d3.select(this).classed("Outliers");
                                            t_interactions.mouseOver(this, t_isOut);
                                        }
                                    });
                                })
                                .on("mouseout", function(){
                                    let t_isOut = d3.select(this).classed("Outliers");
                                    t_interactions.mouseOut(t_isOut);
                                });
                            t_snapshot
                            .each(function(){
                                let v_visibleItem = d3.select(this).data()[0],
                                    t_clsID = v_visibleItem.clsID.split("_"),
                                    t_children = t_clsTree.aggregate;
                                for(let i = 0; i < t_clsID.length; i++){
                                    t_children = t_children[t_clsID[i]];
                                }
                                let t_SSAng = v_visibleItem.SShotAngle,
                                    t_ang = parseFloat(d3.select(this).attr("angle")), t_col;
                                if(v_visibleItem.avgCol != null){
                                    t_col = BasicView.colToRgb(v_visibleItem.avgCol);
                                }else{
                                    t_col = "rgba(0,0,0,0)";
                                }
                                if(t_SSAng == null){
                                    if(isNaN(t_ang)){
                                        t_ang = 0;
                                    }
                                }else{
                                    t_ang = t_SSAng;
                                }
                                let t_weights = t_children.supernode.nghDims;
                                t_weights = numeric.div(t_weights, Math.max(...t_weights));
                                let t_items = d3.select(this)
                                .selectAll("g")
                                .data(t_weights)
                                .enter();
                                let t_g = t_items.append("g")
                                .attr("angle", t_ang)
                                .attr("transform", function(){
                                    let t_trans = [t_outR * Math.cos(t_ang), t_outR * Math.sin(t_ang)];
                                    return "translate(" + t_trans + ")";
                                });
                                t_g
                                .append("path")
                                .attr("d", function(v_weight, vv_j){
                                    let t_arc = d3.svg.arc()
                                    .innerRadius(t_sshotR * 0.3)
                                    .outerRadius(t_sshotR)
                                    .startAngle(vv_j * t_divAngle)
                                    .endAngle(vv_j * t_divAngle + v_weight * t_divAngle * 0.9);
                                    return t_arc();
                                })
                                .attr("fill", t_col);
                            });
                        //     t_snapshot
                        //     .append("circle")
                        //     .attr("angle", function(v_visibleItem){
                        //         let t_SSAng = v_visibleItem.SShotAngle,
                        //             t_ang = parseFloat(d3.select(this).attr("angle"));
                        //         if(t_SSAng == null){
                        //             if(isNaN(t_ang)){
                        //                 return 0;
                        //             }else{
                        //                 return t_ang;
                        //             }
                        //         }else{
                        //             return t_SSAng;
                        //         }
                        //     })
                        //     .attr("cx", function(v_visibleItem){
                        //         let t_ang = parseFloat(d3.select(this).attr("angle"));
                        //         return t_outR * Math.cos(t_ang);
                        //     })
                        //     .attr("cy", function(v_visibleItem){
                        //         let t_ang = parseFloat(d3.select(this).attr("angle"));
                        //         return t_outR * Math.sin(t_ang);
                        //     })
                        //     .attr("r", t_sshotR)
                        //     .attr("fill", (v_visibleItem) => {
                        //         if(v_visibleItem.avgCol != null){
                        //             return BasicView.colToRgb(v_visibleItem.avgCol);
                        //         }else{
                        //             return "rgba(0,0,0,0)";
                        //         }
                        //     });
                        });
                        // .attr("clsID", (v_d) => {return v_d;});
                    // t_ssg.append("line")
                    // .append("line")
                    // .attr("x1")
                    // .attr("y1")
                    // .attr("x2")
                    // .attr("y2");
                }else{
                    let t_par = this.snapshotPar,
                        t_r = t_par.ringR,
                        t_sshotR = t_par.sshotR,
                        t_outR = t_par.outR,
                        t_d3 = this.d3el,
                        t_clsVisible = this.currentCls.visible,
                        t_duration = this.transition.short,
                        t_selection = t_d3.selectAll(".SubMapSShotLevel"),
                        t_showSelection = t_selection.filter((v_d, v_i) => {return t_clsVisible[v_i].atLevel;}),
                        t_hideSelection = t_selection.filter((v_d, v_i) => {return !t_clsVisible[v_i].atLevel;});
                    BasicView.hide("SShots_show", t_showSelection, t_duration, false);
                    BasicView.hide("SShots_hide", t_hideSelection, t_duration, true);
                    t_selection.each(function(v_di, v_i){
                        let t_visibleLevel = t_clsVisible[v_i];
                        d3.select(this)
                        .selectAll(".SubMapSShot .SubMapSSAnchor")
                        .attr("cx", function(v_dj){
                            let t_ind = parseInt(d3.select(this).attr("index")),
                                t_avgPos = t_visibleLevel[t_ind].avgPos;
                            if(t_avgPos != null){
                                return t_avgPos[0];
                            }else{
                                return 0;
                            }
                        })
                        .attr("cy", function(v_dj, v_j){
                            let t_ind = parseInt(d3.select(this).attr("index")),
                                t_avgPos = t_visibleLevel[t_ind].avgPos;
                            if(t_avgPos != null){
                                return t_avgPos[1];
                            }else{
                                return 0;
                            }
                        })
                        .style("display", function(v_dj, v_j){
                            let t_avgPos = t_visibleLevel[v_j].avgPos;
                            return t_avgPos?"block":"none";
                        });
                        // d3.select(this)
                        // .selectAll(".SubMapSnapshot circle")
                        // .attr("angle", function(v_visibleItem){
                        //     let t_SSAng = v_visibleItem.SShotAngle,
                        //         t_ang = parseFloat(d3.select(this).attr("angle"));
                        //     if(t_SSAng == null){
                        //         if(isNaN(t_ang)){
                        //             return 0;
                        //         }else{
                        //             return t_ang;
                        //         }
                        //     }else{
                        //         return t_SSAng;
                        //     }
                        // })
                        // .attr("cx", function(v_visibleItem){
                        //     let t_ang = parseFloat(d3.select(this).attr("angle"));
                        //     return t_outR * Math.cos(t_ang);
                        // })
                        // .attr("cy", function(v_visibleItem){
                        //     let t_ang = parseFloat(d3.select(this).attr("angle"));
                        //     return t_outR * Math.sin(t_ang);
                        // })
                        // .style("display", function(v_dj, v_j){
                        //     let t_avgPos = t_visibleLevel[v_j].avgPos;
                        //     return t_avgPos?"block":"none";
                        // });
                        d3.select(this)
                        .selectAll(".SubMapSnapshot")
                        .each(function(v_visibleItem, v_j){
                            let t_SSAng = v_visibleItem.SShotAngle,
                                t_ang = parseFloat(d3.select(this).attr("angle"));
                            if(t_SSAng == null){
                                if(isNaN(t_ang)){
                                    t_ang = 0;
                                }
                            }else{
                                t_ang = t_SSAng;
                            }
                            let t_trans = [t_outR * Math.cos(t_ang), t_outR * Math.sin(t_ang)];
                            d3.select(this).selectAll("g")
                            .attr("transform", "translate(" + t_trans + ")")
                            .style("display", function(){
                                let t_avgPos = t_visibleLevel[v_j].avgPos;
                                return t_avgPos?"block":"none";
                            });
                        });
                    });
                }   
            },

            showRing: function(){
                let t_codes = this.fCodes.codes,
                    t_dataInd = this.fCodes.dataIndeces,
                    t_dimInd = this.fCodes.dimIndeces,
                    t_dataLength = t_codes.length,
                    t_dimLength = t_codes[0].length,
                    t_angles = new Array(t_dimLength),
                    t_angCount = new Array(t_dimLength),
                    t_ringRRatio = this.snapshotPar.ringRRatio,
                    t_divRatio = 0.4,
                    t_divDegree = 360 / t_dimLength,
                    t_addDegree = 0,
                    t_freeCount = 0,
                    t_fixCount = 0,
                    t_divAngle = Math.PI * 2 / t_dimLength * t_divRatio;
                t_angles.fill(0);
                t_angCount.fill(0);
                for(let i = 0; i < t_dimLength; i++){
                    t_angles[t_freeCount] = t_addDegree;
                    t_freeCount++;
                    t_addDegree += t_divDegree;
                }
                let t_scales = this.scales,
                    t_r = (t_scales.x.range()[1] - t_scales.x.range()[0]) * t_ringRRatio,
                    t_radius = 8,
                    t_radScale = 1.3,
                    t_radAngle = Math.asin(t_radius * t_radScale / 2 / t_r) * 2,
                    t_arcR = [t_r - t_radius * 0.7, t_r + t_radius * 0.7],
                    t_arcAngle = (t_divAngle - t_radAngle) * 0.95,
                    t_this = this,
                    t_setArc = function(v_portion, v_radius, v_divAngle){
                        let t_startAngle = - v_divAngle,
                            t_endAngle = (-1 + v_portion * 2) * v_divAngle,
                            t_arc = d3.svg.arc()
                            .innerRadius(v_radius[0])
                            .outerRadius(v_radius[1])
                            .startAngle(t_startAngle)
                            .endAngle(t_endAngle);
                        return t_arc();
                    },
                    t_updateBars = function(v_indeces){
                        let t_allLength = t_dataLength,
                            t_subLength,
                            t_indeces = v_indeces;
                        if(t_indeces == null){
                            t_indeces = new Array(t_allLength);
                            for(let i = 0; i < t_allLength; i++){
                                if(t_dataInd == null){
                                    t_indeces[i] = i;
                                }else{
                                    t_indeces[i] = t_dataInd[i];
                                }
                            }
                        }else{
                            t_subLength = v_indeces.length;
                            if(t_subLength == 0){
                                t_subLength = 1;
                            }
                        }
                        let t_coverage = t_this.collection.getCoverage(t_indeces);
                        t_this.d3el.selectAll(".SubMapDim")
                        .forEach(v_gs => {
                            v_gs.forEach(v_g => {
                                let t_g = d3.select(v_g),
                                    t_dim = t_g.attr("dimID"),
                                    t_portion = t_coverage[t_dim] / (t_subLength == null?t_allLength:t_subLength),
                                    // t_portion = t_coverage[t_dim] / t_allLength,
                                    t_bar = t_g.selectAll(".bar");
                                if(t_bar.empty()){
                                    t_g
                                    .selectAll(".bar")
                                    .data([t_portion])
                                    .enter()
                                    .append("path")
                                    .attr("class", "bar")
                                    .attr("d", v_portion => {
                                        return t_setArc(v_portion, t_arcR, t_arcAngle)
                                    });
                                }else{
                                    let t_data = t_g.selectAll(".bar").data()[0];
                                    t_g
                                    .selectAll(".bar")
                                    .data([t_portion])
                                    .transition()
                                    .attrTween("d", v_portion => {
                                        let t_inter = d3.interpolate(t_data, v_portion),
                                            tween = function(t){
                                            let t_interData = t_inter(t);
                                            return t_setArc(t_interData, t_arcR, t_arcAngle);
                                        };
                                        return tween;
                                    });
                                }
                            })
                        });
                    },
                    t_setDim = function(v_g, v_radius, v_i, v_dim, v_sign){
                        let t_dimCover = new Array(t_dimInd.length);
                        if(v_i != null){
                            let t_parent = $(v_g).parent()[0],
                            t_index = t_dimInd[v_i];
                            d3.select(t_parent)
                            .classed("active", v_sign);
                            d3.select(t_parent)
                            .selectAll("circle.active")
                            .transition()
                            .attr("r", v_radius);
                            d3.select(t_parent)
                            .selectAll("circle")
                            .classed("active", false);
                            if(v_sign){
                                d3.select(v_g)
                                .classed("active", true)
                                .transition()
                                .attr("r", v_radius * t_radScale);
                            }
                            t_this.dimCover[t_index] = v_dim;
                        }else{
                            v_g.filter(function(v_angle, v_i){
                                let tt_index = t_dimInd[v_i],
                                    t_cover = t_this.dimCover[tt_index];
                                if(t_cover >= 0){
                                    let t_class = t_cover == 1?".On":".Off";
                                    d3.select(this)
                                    .select(t_class)
                                    .classed("active", true);
                                    return true;
                                }else{
                                    return false;
                                }
                            })
                            .classed("active", true)
                            .selectAll(".active")
                            .transition()
                            .attr("r", v_radius * t_radScale);
                        }
                        for(let i = 0; i < t_dimInd.length; i++){
                            t_dimCover[i] = t_this.dimCover[t_dimInd[i]];
                        }
                        let t_returnID = (v_this, v_d) => {
                                return v_d.id;
                            }, t_ids = SubGlyph.filterGlyphsByDims(t_this.d3el, t_dimCover, null, t_returnID);
                        return t_ids;
                    },
                    t_g = this.d3el
                    .append("g")
                    .attr("class", "SubMapRings")
                    .attr("transform", "translate(" + Basic.scale(t_scales, [0.5, 0.5]) + ")")
                    .selectAll(".SubMapDim")
                    .data(t_angles)
                    .enter()
                    .append("g")
                    .attr("class", "SubMapDim")
                    .attr("dimID", (v_angle, v_i) => {return t_dimInd[v_i];})
                    .attr("transform", (v_angle, v_i) => {
                        return "rotate(" + v_angle + ")";
                    });
                t_g.append("text")
                .attr("x", (v_angle, v_i) => {
                    let t_text = this.collection.dimensions[t_dimInd[v_i]];
                    return -t_text.visualLength()[0] / 2;
                })
                .attr("y", (v_angle, v_i) => {
                    let t_text = this.collection.dimensions[t_dimInd[v_i]],
                        t_rotate = v_angle >= 90 && v_angle < 270;
                    return (t_r + t_radius + 10) * (t_rotate?1:-1)
                            + (t_rotate?(t_text.visualLength()[1]/2):0);
                })
                .attr("transform", (v_angle, v_i) => {
                    return "rotate(" + ((v_angle >= 90 && v_angle < 270)?180:0) + ")";
                })
                .text((v_angle, v_i) => {
                    return this.collection.dimensions[t_dimInd[v_i]];
                });
                t_g.append("circle")
                .classed("On", true)
                .attr("cx", t_r * Math.sin(-t_divAngle + Math.PI))
                .attr("cy", t_r * Math.cos(-t_divAngle + Math.PI))
                .attr("r", t_radius)
                .on("click", function(v_angle, v_i){
                    let t_active = d3.select(this).classed("active"),
                        t_indeces;
                    if(!t_active){
                        t_indeces = t_setDim(this, t_radius, v_i, 1, !t_active);
                    }else{
                        t_indeces = t_setDim(this, t_radius, v_i, -1, !t_active);
                    }
                    t_updateBars(t_indeces);
                });
                t_g.append("circle")
                .classed("Off", true)
                .attr("cx", t_r * Math.sin(t_divAngle + Math.PI))
                .attr("cy", t_r * Math.cos(t_divAngle + Math.PI))
                .attr("r", t_radius)
                .on("click", function(v_angle, v_i){
                    let t_active = d3.select(this).classed("active"),
                        t_indeces;
                    if(!t_active){
                        t_indeces = t_setDim(this, t_radius, v_i, 0, !t_active);
                    }else{
                        t_indeces = t_setDim(this, t_radius, v_i, -1, !t_active);
                    }
                    t_updateBars(t_indeces);
                });
                t_g.append("path")
                .classed("frame", true)
                .attr("d", t_setArc(1.0, t_arcR, t_arcAngle));
                let t_indeces = t_setDim(d3.selectAll(".SubMapDim"), t_radius, null, null, false);
                if(t_indeces.length == 0){
                    t_updateBars();
                }else{
                    t_updateBars(t_indeces);
                }
            },

            bindTuning: function(){
                $("#Pattern")
                .on("click", ()=>{
                    let t_gs = d3.selectAll(".SubMapGrids");
                    this.pattern = !this.pattern;
                    SubGlyph.changeGlyph(t_gs, this.pattern, this.nghDims);
                    if(this.pattern){
                        $("#Pattern #text").text("Hide Pattern");
                    }else{
                        $("#Pattern #text").text("Show Pattern");
                    }
                })
            },

            aggregate: function(){
                class t_clsInfoObj {
                    constructor(v_prevObj, v_treePath, v_isOut = false, v_nghPatterns, v_aggrDims){
                        let t_nghPatterns = new Map(), t_prevPatterns = v_prevObj?v_prevObj.patterns:null,
                            t_aggrDims = new Array(t_dimCount).fill(0), t_prevDims = v_prevObj?v_prevObj.dimensions:null,
                            t_treePath = new Array();
                        this.dimensions = (v_aggrDims == null)?(t_prevDims?t_prevDims:t_aggrDims):v_aggrDims;
                        this.patterns = (v_nghPatterns == null)?(t_prevPatterns?t_prevPatterns:t_nghPatterns):v_nghPatterns;
                        this.index = (v_treePath == null)?t_treePath:v_treePath;
                        this.outliers = v_isOut;
                    };
                    combineWith(v_clsInfoObj){
                        let t_combineValues = (v_count_i, v_count_j) => {
                            return v_count_i + v_count_j;
                        };
                        this.dimensions = numeric.add(this.dimensions, v_clsInfoObj.dimensions);
                        this.patterns = Basic.combineMaps(this.patterns, v_clsInfoObj.patterns, t_combineValues);
                    };
                };
                let t_subTreeFunc = (v_subNodes, v_treePath) => {
                    if(v_subNodes.length == 1){
                        let t_clsInfo = new t_clsInfoObj(v_subNodes[0].supernode, v_treePath);
                        return t_clsInfo;
                    }
                    let t_clsInfo = new t_clsInfoObj(null, v_treePath);
                    if(v_subNodes.length == 0){
                        return t_clsInfo;
                    }
                    for(let i = 0; i < v_subNodes.length; i++){
                        t_clsInfo.combineWith(v_subNodes[i].supernode);
                    }
                    return t_clsInfo;
                }, t_leavesFunc = (v_leaves, v_onlyLeaves, v_treePath) => {
                    let t_clsInfo = new t_clsInfoObj(null, v_treePath, !v_onlyLeaves),
                        t_patternMap = t_clsInfo.patterns,
                        t_dimensions = t_clsInfo.dimensions;
                    for(let i = 0; i < v_leaves.length; i++){
                        let t_ind = v_leaves[i],
                            t_nghs = t_nghList[t_ind],
                            tt_code_i = t_codes[t_ind];
                        // collect dimension patterns (i.e. local dim weights)
                        for(let j = 0; j < t_nghs.length; j++){
                            let t_ngh = t_nghs[j], tt_code_j = t_codes[t_ngh],
                                t_extDims = t_maskMap.findPair(t_ind, t_ngh),
                                t_nghDims;
                            if(t_extDims == null){
                                t_nghDims = new Array(t_dimCount).fill(0);
                                for(let k = 0; k < tt_code_i.length; k++){
                                    if(tt_code_i[k] == tt_code_j[k]){
                                        t_nghDims[k] = 1;
                                    }
                                }
                                t_nghDims = t_nghDims.join("");
                                t_maskMap.setPair(t_ind, t_ngh, t_nghDims);
                            }else{
                                t_nghDims = t_extDims;
                            }
                            if(!t_patternMap.has(t_nghDims)){
                                t_patternMap.set(t_nghDims, 0);
                            }
                            t_patternMap.set(t_nghDims, t_patternMap.get(t_nghDims) + 1);
                        }
                        // collect dimension counts
                        for(let j = 0; j < tt_code_i.length; j++){
                            if(tt_code_i[j] == 1){
                                t_dimensions[j] ++;
                            }
                        }
                    }
                    return {
                        supernode: t_clsInfo,
                        leafnode: v_leaves,
                    };
                };
                let t_codes = this.fCodes.codes,
                    t_nghList = this.fMatrix.neighbors,
                    t_subNum = t_codes.length,
                    t_dimCount = t_codes[0].length,
                    t_ovlNghDims = Basic.initArray(t_subNum, t_dimCount),// ovlNghDims: local dim weights of each subspace
                    t_maskMap = new Map();// shared dimensions in each pair of ngh subspaces
                t_maskMap.findPair = function(v_i, v_j){
                    let t_key = (v_i < v_j)?(v_i + "_" + v_j):(v_j + "_" + v_i);
                    return this.get(t_key);
                };
                t_maskMap.setPair = function(v_i, v_j, v_mask){                    
                    let t_key = (v_i < v_j)?(v_i + "_" + v_j):(v_j + "_" + v_i);
                    for(let k = 0; k < v_mask.length; k++){
                        if(v_mask[k] == "1"){
                            t_ovlNghDims[v_i][k]++;
                            t_ovlNghDims[v_j][k]++;
                        }
                    }
                    return this.set(t_key, v_mask);
                }
                let t_aggrClsTree = this.currentCls.aggregate
                = Basic.traverseTree(this.currentCls.clusters, t_subTreeFunc, t_leavesFunc);
                t_ovlNghDims.extent = Basic.extArray(t_ovlNghDims);
                this.nghDims = t_ovlNghDims;
                let t_dimNum = this.nghDims[0].length;
                let t_simpleTree = (v_tree) => {
                    let t_result = new Array(t_dimNum).fill(0);
                    for(let i = 0; i < v_tree.length; i++){
                        let t_child_result = new Array(t_dimNum).fill(0);
                        if(typeof(v_tree[i][0]) == "object"){
                            t_child_result = t_simpleTree(v_tree[i]);
                        }else{
                            for(let j = 0; j < v_tree[i].length; j++){
                                t_child_result = numeric.add(t_child_result, t_ovlNghDims[v_tree[i][j]]);
                            }
                            v_tree[i].supernode.nghDims = t_child_result;
                        }
                        t_result = numeric.add(t_result, t_child_result);
                    }
                    v_tree.supernode.nghDims = t_result;
                    return t_result;
                };
                t_simpleTree(t_aggrClsTree);
                // this.aggregateTree = t_aggregate;
                // t_aggregate = Basic.mapToArray(this.aggregate, "entries");
                // let t_aggrMax = -Infinity, t_aggrMin = Infinity;
                // for(let i = 0; i < t_aggregate.length; i++){
                //     if(eval(t_aggregate[i][0].split("").join("+")) == 1){
                //         continue;
                //     }
                //     if(t_aggregate[i][1] > t_aggrMax){
                //         t_aggrMax = t_aggregate[i][1];
                //     }
                //     if(t_aggregate[i][1] < t_aggrMin){
                //         t_aggrMin = t_aggregate[i][1];
                //     }
                // }
                // return [t_aggrMin, t_aggrMax];
            },

            showGrids: function(){
                var self = this, t_scales = self.parameter.scales, t_dims = self.collection.dimCount;
                var t_grids = [], t_gridScale, t_gridSize;
                var t_projection = self.collection.projection;
                var initGrids = function(v_num, v_grids){
                    var t_xNum = v_num, t_xLength = 1 / t_xNum,
                        t_yLength = t_xLength * Math.sqrt(3)/2,
                        t_yTop = t_xLength * Math.sqrt(3)/3, 
                        t_yNum = Math.floor(1 / t_yLength);
                    var t_gridSize = t_xLength / 2;
                    for(var i = 0; i < t_yNum; i++){
                        var tt_grids = [];
                        for(var j = 0; j < t_xNum; j++){
                            var t_cords = [((i%2==1?1:0.5) + j) * t_xLength, t_yTop + i * t_yLength];
                            var tt_grid = {count: 0, cords: t_cords, dims: new Array(t_dims).fill(0)};
                            tt_grids.push(tt_grid);
                        }
                        v_grids.push(tt_grids);
                    }
                    var t_getDist = function(vv_x, vv_y, vv_cords){
                        var tt_cords = v_grids[vv_y][vv_x].cords;
                        return {
                            index: [vv_y, vv_x],
                            dist: Math.pow(tt_cords[0] - vv_cords[0], 2) + Math.pow(tt_cords[1] - vv_cords[1], 2),
                        }
                    };
                    var t_gridScale = function(vv_x, vv_y){
                        var tt_y = (vv_y < t_yTop)?0:((vv_y - t_yTop) / t_yLength), tt_x;
                        var tt_yf = Math.floor(tt_y), tt_yc = Math.ceil(tt_y);
                        if(tt_yf == tt_yc){
                            if(tt_yf % 2 == 0){
                                tt_x = Math.floor(vv_x / t_xLength);
                            }else{
                                tt_x = (vv_x < t_xLength/2)?0:Math.floor(vv_x / t_xLength - 0.5);
                            }
                        }else{
                            var ttt_odd, ttt_even, ttt_dists = [];
                            if(tt_yf % 2 == 0){
                                ttt_odd = tt_yc;
                                ttt_even = tt_yf;
                            }else{
                                ttt_odd = tt_yf;
                                ttt_even = tt_yc;
                            }
                            var ttt_x = Math.floor(vv_x / t_xLength);
                            if(ttt_x == 0){
                                tt_x = 0;
                                ttt_dists[0] = (t_getDist(0, ttt_odd, [vv_x, vv_y]));
                                ttt_dists[1] = (t_getDist(0, ttt_even, [vv_x, vv_y]));
                                if(ttt_dists[0].dist < ttt_dists[1].dist){
                                    tt_y = ttt_odd;
                                }else{
                                    tt_y = ttt_even;
                                }
                            }else{
                                if(ttt_x == t_xNum){
                                    ttt_x = t_xNum - 1;
                                }
                                if(ttt_odd == t_yNum){
                                    ttt_odd--;
                                }
                                if(ttt_even == t_yNum){
                                    ttt_even--;
                                }
                                if(ttt_even < t_yNum){
                                    ttt_dists.push(t_getDist(ttt_x - 1, ttt_even, [vv_x, vv_y]));
                                    ttt_dists.push(t_getDist(ttt_x, ttt_even, [vv_x, vv_y]));
                                    if(ttt_x < t_xNum - 1){
                                        ttt_dists.push(t_getDist(ttt_x + 1, ttt_even, [vv_x, vv_y]));
                                    }
                                }
                                if(ttt_odd < t_yNum){
                                    ttt_dists.push(t_getDist(ttt_x, ttt_odd, [vv_x, vv_y]));
                                    if(ttt_x < t_xNum - 1){
                                        ttt_dists.push(t_getDist(ttt_x + 1, ttt_odd, [vv_x, vv_y]));
                                    }
                                }
                                ttt_dists.sort(function(a, b){
                                    return a.dist - b.dist;
                                });
                                tt_x = ttt_dists[0].index[1];
                                tt_y = ttt_dists[0].index[0];
                            }
                        }
                        return [tt_y, tt_x];
                    }
                    return {
                        scale: t_gridScale,
                        size: t_gridSize,
                    }
                };
                var aggrGrids = function(v_points, v_grids, v_gridScale){
                    var t_indeces = self.collection.subIndex;
                    for(var i = 0; i < v_points.length; i++){
                        var t_gridCords = v_gridScale(v_points[i][0], v_points[i][1]),
                            t_i = t_gridCords[0], t_j = t_gridCords[1];
                        v_grids[t_i][t_j].count++;
                        v_grids[t_i][t_j].dims = numeric.add(v_grids[t_i][t_j].dims, t_indeces[i]);
                    }
                    for(var i = 0; i < v_grids.length; i++){
                        for(var j = 0; j < v_grids[0].length; j++){
                            var t_count = v_grids[i][j].count;
                            if(t_count > 0){
                                v_grids[i][j].dims = numeric.div(v_grids[i][j].dims, t_count);
                            }
                        }
                    }
                };
                var showGlyph = function(v_g, v_r, v_dims, v_maxR){
                    var t_factor = 2 * Math.sqrt(3) / 3, 
                        t_maxR = v_maxR * t_factor, 
                        t_r = v_r * t_factor;
                    v_g.append("path")
                    .attr("d", d3.hexbin().hexagon(t_r))
                    .classed("cell", true);
                    if(v_r > 0){
                        var t_div = Math.PI * 2 / v_dims.length;
                        for(var i = 0; i < v_dims.length; i++){
                            var tt_ang = t_div * i;
                            v_g.append("line")
                            .attr("class", "weights")
                            .attr("x1", 0)
                            .attr("y1", 0)
                            .attr("x2", v_maxR * 0.8 * v_dims[i] * Math.cos(tt_ang))
                            .attr("y2", v_maxR * 0.8 * v_dims[i] * Math.sin(tt_ang));
                        }
                    }
                    v_g.append("path")
                    .attr("d", d3.hexbin().hexagon(t_maxR))
                    .classed("frame", true)
                    .classed("light", v_r==0);
                };
                var drawGrids = function(v_g, v_grids, v_gridSize, v_scales){
                    var tt_max = 0, tt_min = Infinity;
                    for(var i = 0; i < v_grids.length; i++){
                        for(var j = 0; j < v_grids[0].length; j++){
                            var ttt_count = v_grids[i][j].count;
                            if(ttt_count > tt_max){
                                tt_max = ttt_count;
                            }
                            if(ttt_count < tt_min){
                                tt_min = ttt_count;
                            }
                        }
                    }
                    var t_rSize = (v_scales.x.range()[1] - v_scales.x.range()[0]) / v_grids[0].length * 0.5;
                    var tt_rscale = d3.scale.linear().domain([tt_min, tt_max]).range([0, t_rSize]);
                    var tt_g = v_g.append("g")
                    .classed("SubMapGrids", true);
                    for(var i = 0; i < v_grids.length; i++){
                        var tt_jlength = v_grids[0].length - ((i%2==1)?1:0);
                        for(var j = 0; j < tt_jlength; j++){
                            var tt_pos = Basic.scale(v_scales, v_grids[i][j].cords);
                            var ttt_g = tt_g.append("g")
                            .classed("SubMapGrid", true)
                            .attr("id","SubMapGrid_"+i+"_"+j)
                            .attr("transform", "translate(" + tt_pos + ")");
                            showGlyph(ttt_g, tt_rscale(v_grids[i][j].count), v_grids[i][j].dims, t_rSize);
                        }
                    }
                };
                var t_gridsReturn = initGrids(Config.get("gridNumber"), t_grids);
                t_gridScale = t_gridsReturn.scale; t_gridSize = t_gridsReturn.size;
                aggrGrids(t_projection, t_grids, t_gridScale);
                drawGrids(self.d3el, t_grids, t_gridSize, t_scales);
            },

            showProjection: function(){
                var self = this, t_projection = self.collection.projection, 
                    t_scales = self.parameter.scales, t_r = self.parameter.r,
                    t_colors = self.collection.colors;
                self.d3el
                .append("g")
                .classed("SubMapModels", true)
                .selectAll(".SubMapModel")
                .data(self.collection.models)
                .enter()
                .append("g")
                .classed("SubMapModel", true)
                .attr("id", function(t_d){
                    return "SubMapModel_" + t_d.id;
                })
                .attr("transform", function(t_d){
                    var t_ind = t_d.id, t_pos = t_projection[t_ind];
                    return "translate(" + Basic.scale(t_scales, t_pos) + ")";
                })
                .on("click", function(t_d){
                    self.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: t_d.subspace});
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", t_r)
                .attr("fill", function(t_d){
                    // var t_ind = t_d.id, t_col = t_colors[t_ind];
                    // t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                    // return "rgb(" + t_col + ")";
                    return "#000"
                })
                .append("title")
                .text(function(t_d){
                    return t_d.code;
                });
            },

            showModels: function(){
                let t_td = this.collection.tpModel.TDims, t_scales = this.scales, t_r = this.r;
                let t_m = numeric.transpose(this.collection.tpModel.DTMatrix), t_sum = numeric.sum(t_m);
                let t_arc = d3.svg.arc(), t_ratio = 3;
                let t_g = this.d3el.selectAll(".SubMapTopics")
                .data(t_td)
                .enter()
                .append("g")
                .classed("SubMapTopics", true)
                .attr("transform", function(t_d, t_i){
                    let t_pos = [1.1, t_i * 1/(t_td.length + 1)];
                    return "translate(" + Basic.scale(t_scales, t_pos) + ")";
                });
                t_g.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", function(t_d, t_i){
                    return t_r * t_ratio * 1.5 * numeric.sum(t_m[t_i]) / t_sum;
                })
                .attr("fill","#000")
                .on("mouseover", function(t_d, t_i){
                    d3.select($(this).parent()[0])
                    .selectAll("path")
                    .attr("stroke-width", 3);
                    d3.selectAll(".SubMapModel")
                    .attr("opacity", function(){
                        let t_id = $(this).attr("id").replace("SubMapModel_", ""),
                        t_sum = numeric.sum(t_m[t_i]);
                        let t_mx = _.max(t_m[t_i]), t_mn = _.min(t_m[t_i]), t_w = (t_m[t_i][t_id] - t_mn)/(t_mx - t_mn);
                        return t_w;
                    })
                })
                .on("mouseout", function(){
                    d3.select($(this).parent()[0])
                    .selectAll("path")
                    .attr("stroke-width", 1);
                    d3.selectAll(".SubMapModel")
                    .attr("opacity", 1);
                });
                let t_step = Math.PI*2/(t_td[0].length);
                for(let i = 0; i < t_td[0].length; i++){
                    t_g.append("path")
                    .attr("d", function(t_d){
                        t_arc.startAngle(i * t_step)
                        .endAngle((i+1) * t_step)
                        .innerRadius(t_r * t_ratio)
                        .outerRadius(t_r * t_ratio * (1 + 2 * t_d[i]));
                        return t_arc();
                    })
                    .attr("stroke", "#000")
                    .attr("fill", "none");
                }
            },

            clearAll: function(){
                this.d3el.selectAll("g").remove();
                let t_clean = {
                    dimCover: new Array(this.collection.dimCount).fill(-1),
                    distMat: null,
                    diffMat: null,
                    distExt: null,
                    nghList: null,
                    zoomed: false,
                    newData: true,
                    visible: null,
                    pattern: false,
                    nghDims: null,
                    freeDim: null,
                    fCodes: null,
                    fMatrix: null,
                    colors: null,
                    currentColors: null,
                    colorFixed: false,
                    transition: Config.get("transition"),
                    overallCls: {
                        clusters: null,
                        level: null,
                        paths: null,
                        aggregate: null,
                        visible: null,
                    },
                    currentCls: {
                        clusters: null,
                        level: null,
                        paths: null,
                        aggregate: null,
                        visible: null,
                    },
                    isNew: true,
                    overallMap: null,
                    mapTransition: {
                        indeces: null,// old indeces
                        tranIndeces: null,// transition from old to current indeces
                        nameBook: null,// original id to current indeces
                        colors: null,
                    },
                    clsColorReady: false,
                }
                Object.assign(this, t_clean);
                $("#Pattern #text").text("Show Pattern");
            },

            clearCanvas: function(){
                // this.d3el.selectAll("g").remove();
                // let t_time = this.visible.toLevel([0, 0], 0, this.transition.long);
                // setTimeout(() => {
                this.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__HideProjection", data: null});
                // }, t_time);
            },
        },Base));

        return SubMap_CollectionView;
    });
