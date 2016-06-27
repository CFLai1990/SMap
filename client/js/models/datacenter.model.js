/**
 * Created by Chufan Lai at 2015/12/14
 * model for fetching and processing data
 */

 define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'config',
    'variables',
    'data',
    'viewpointcollection',
    'viewmapcollection',
    ], function(require, Mn, _, $, Backbone, Config, Variables, Data, ViewPointCollection, ViewMapCollection){
        'use strict';

        var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

        return window.Datacenter = new (Backbone.Model.extend({
            defaults: function(){
                return {
                    data: null,
                    distK: 3,
                    distType: null,
                };
            },

            initialize: function(url){
                var self = this;
                this.set("distType", Config.get("distType"));
                var t_default = {
                    ready: false,
                    shown: false,
                    colorPickerDiv: 'colorPickerDiv',
                    colorPicker: 'colorPicker',
                    transition: Config.get("transition"),
                    colorPickerObjs: null,
                };
                _.extend(this, t_default);
                this.data = new Data();
                this.viewpointcollection = new ViewPointCollection();
                this.viewmapcollection = new ViewMapCollection();
                this.bindAll();
            },

            bindAll: function(){
                this.listenTo(this.data, "Data__DataReady", this.updateData);
            },

            start: function(){
                this.trigger("DataCenter__initialized");
                this.loadData(Config.get('dataPath'));
            },

            loadData: function(v_path){
                var self = this;
                d3.csv(v_path, function(d){
                    self.data.update({
                        data: d,
                        dimensions: _.allKeys(d[0]),
                        sampling: v_path.indexOf("swissroll")>=0,
                    });
                });
            },

            updateData: function(){
                console.info("DataCenter: data ready!");
                this.viewpointcollection.clearAll();
                this.viewmapcollection.clearAll();
            // this.coordEachPoint();
            var t_cord;
            // switch(Config.get("optimization")){
            //     case "Expand":
            //         t_cord = MDS.getCoordinates(this.data.dataArray, true);
            //     break;
            //     case "Compress":
            //         t_cord = MDS.getCoordinates(this.data.dataArray, false);
            //     break;
            //     case "Separate":
            //         t_cord = MDS.getCoordinates(this.data.dataArray, true);
            //     break;
            // }
            Config.set("optimization", "Expand");
            this.trigger("DataCenter__changeOpti", {state: 'Expand', disable: ['Separate']});
            t_cord = MDS.getCoordinates(this.data.dataArray, true);
            this.addFocus([], t_cord, 'Expand');
            this.showClusters(t_cord);
            Config.get("data").array = this.data.dataArray;
            Config.get("data").distances = MDS.getSquareDistances(this.data.dataArray);
            this.setExtent(this.data.dataArray);
            this.viewpointcollection.setData(this.data.dataArray);
            this.viewpointcollection.InitializeViewpoints(t_cord);
        },

        updateCoordinates: function(v_inds, v_dimCount){
            var t_opti, t_cord;
            if(v_inds.length>0){
                this.trigger("DataCenter__changeOpti", {state: null, disable: []});
                t_opti = Config.get("optimization");
                t_cord = this.getCoordinatesWithSubspace(v_inds, t_opti, v_dimCount);
            }else{
                Config.set("subspace", Config.get("subspaceAll"));
                t_opti = Config.get("optimization");
                if(t_opti == 'Separate'){
                    Config.set("optimization", "Expand");
                    t_opti = 'Expand';
                    this.trigger("DataCenter__changeOpti", {state: 'Expand', disable: ['Separate']});
                }else{
                    this.trigger("DataCenter__changeOpti", {state: null, disable: ['Separate']});
                }
                t_cord = this.getCoordinatesWithSubspace(v_inds, t_opti, v_dimCount);
            }
            this.showClusters(t_cord);
            this.viewmapcollection.clearShown();
            this.viewpointcollection.getCoordinates(t_cord, v_inds, t_opti);
        },

        getSubspace: function(v_data, v_sub){
            var t_tdata = trans(v_data), t_result = [];
            for(var i in t_tdata){
                if(v_sub[i]){
                    t_result.push(t_tdata[i]);
                }
            }
            return trans(t_result);
        },

        getCoordinatesWithSubspace: function(v_inds, v_opti, v_dimCount){
            var self = this, t_sign = Config.get("useSubspace"), t_subThres = Config.get("subThreshold"), t_cord = [];
            if(t_sign && v_inds.length != 0){
                var t_dims = [], tt_cord = [];
                tt_cord = self.getCoordinates(v_inds, v_opti, Config.get("subspaceAll"));
                for(var i in tt_cord){
                    var t_score = norm2Squared(tt_cord[i]) / 2;
                    t_dims.push({
                        length: t_score,
                        order: i,});
                }
                var t_sub = [], t_sum = 0, tt_sign = true, t_num = 0;
                t_dims.sort(function(a,b){return b.length - a.length;});
                for(var i in t_dims){
                    t_sub[t_dims[i].order] = tt_sign;
                    if(tt_sign){
                        t_sum += t_dims[i].length;
                    }
                    if(tt_sign){
                        t_num ++;
                    }
                    if(v_dimCount){
                        if(i == v_dimCount - 1){
                            tt_sign = false;
                        }
                    }else{
                        if(t_sum >= t_subThres){
                            tt_sign = false;
                        }
                    }
                }
                Config.set("subspace", t_sub);
                tt_cord = self.getCoordinates(v_inds, v_opti, t_sub);
                if(tt_cord){
                    var j = 0;
                    for(var i in t_sub){
                        if(t_sub[i]){
                            t_cord.push(tt_cord[j]);
                            j++;
                        }else{
                            t_cord.push([0,0]);
                        }
                    }
                }else{
                    for(var i in t_sub){
                        if(t_sub[i]){
                            t_cord.push(tt_cord[i]);
                        }else{
                            t_cord.push([0,0]);
                        }
                    }
                }
            }else{
                t_cord = self.getCoordinates(v_inds, v_opti, Config.get("subspaceAll"));
            }
            self.optimizeData(t_cord);
            return t_cord;
        },

        optimizeData: function(v_data){
            for(var i in v_data){
                for(var j in v_data[i]){
                    var t = v_data[i][j];
                    if(Math.abs(t) < 1e-15){
                        v_data[i][j] =0;
                    }
                }
            }
        },

        getCoordinates: function(v_inds, v_opti, v_sub){
            var t_dataset = this.getSubspace(this.data.dataArray, v_sub), t_points = this.getFocusData(t_dataset, v_inds);
            var t_dim = dim(t_points), t_matrix, t_expand = v_opti, t_IsGroup = true;
            var t_length = t_dataset.length, t_data = [], t_weights = [], t_point = [];
            if(t_points.length == 1){
                t_IsGroup = false;
            }
            var t_cord;
            switch(v_opti){
                case "Expand":
                case "Compress":
                if(v_inds.length>0){
                    switch(this.get("distType")){
                        case "ErrorReducing":
                        for(var i = 0; i < t_dataset.length; i++){
                            t_data.push(sub(t_dataset[i], t_points[0]));
                        }
                        t_matrix = dot(trans(t_data), t_data);
                        break;
                        case "Weighting":
                        if(t_IsGroup){
                            var t_target = [];
                            for(var i = 0; i < v_inds.length; i++){
                                t_target.push(t_dataset[v_inds[i]]);
                            }
                            if(Config.get("useCentroid")){
                                var t_centroid;
                                for(var i in t_target){
                                    if(!t_centroid){
                                        t_centroid = t_target[i];
                                    }else{
                                        t_centroid = add(t_centroid, t_target[i]);
                                    }
                                }
                                t_centroid = div(t_centroid, t_target.length);
                                for(var i = 0; i < t_target.length; i++){
                                    t_data.push(sub(t_target[i], t_centroid));
                                }
                                t_matrix = dot(trans(t_data), t_data);
                            }else{
                                            // var t_target = [];
                                            // if(t_expand){
                                                // for(var i = 0; i < v_inds.length; i++){
                                                //     t_target.push(t_dataset[v_inds[i]]);
                                                // }
                                            // }else{
                                            //     for(var i = 0; i < t_length; i++){
                                            //         if(v_inds.indexOf(i)>=0)
                                            //             continue;
                                            //         t_target.push(t_dataset[i]);
                                            //     }
                                            // }
                                            for(var t = 0; t < t_points.length; t++){
                                                t_point = t_points[t];
                                                t_data = [];
                                                for(var i = 0; i < t_target.length; i++){
                                                    // if(t_expand){
                                                        t_weights[i] = 1;
                                                    // }else{
                                                    //     var t_d = Math.pow(norm2(sub(t_target[i], t_point)),2);
                                                    //     var tt_dist = t_d*t_d;
                                                    //     t_weights[i] = tt_dist;
                                                    // }
                                                }
                                                for(var i = 0; i < t_target.length; i++){
                                                    t_data.push(mul(sub(t_target[i], t_point), t_weights[i]));
                                                }
                                                if(!t_matrix){
                                                    t_matrix = dot(trans(t_data), t_data);
                                                }else{
                                                    var tt_matrix = dot(trans(t_data), t_data);
                                                    t_matrix = add(t_matrix, tt_matrix);
                                                }
                                            }
                                        }
                                    }else{
                                        for(var t = 0; t < t_points.length; t++){
                                            t_point = t_points[t];
                                            t_data = [];
                                            for(var i = 0; i < t_length; i++){
                                                var t_d = Math.pow(norm2(sub(t_dataset[i], t_point)),2);
                                                    var tt_dist = 1///(0.000000000001+ t_d);//Math.pow(t_d, 2);
                                                    t_weights[i] = tt_dist;
                                                }
                                                for(var i = 0; i < t_dataset.length; i++){
                                                    t_data.push(mul(sub(t_dataset[i], t_point),t_weights[i]));
                                                }
                                                if(!t_matrix){
                                                    t_matrix = dot(trans(t_data), t_data);
                                                }else{
                                                    var tt_matrix = dot(trans(t_data), t_data);
                                                    t_matrix = add(t_matrix, tt_matrix);
                                                }
                                            }
                                        }
                                        break;
                            // case "KNN":
                            //     var t_ids = [], t_dist = d3.map();
                            //     for(var i = 0; i < t_length; i++){
                            //         var tt_dist = norm2(sub(t_dataset[i], v_point));
                            //         t_dist.set(i, tt_dist);
                            //         t_weights[i] = 0;
                            //     }
                            //     t_dist = t_dist.entries();
                            //     t_dist.sort(function(a,b){return a.value-b.value;});
                            //     for(var i = 0; i < this.get("distK"); i++){
                            //         var t_i = t_dist[i].key;
                            //         t_weights[t_i] = 1/(0.00001+t_dist[i].value);
                            //     }
                            //     for(var i = 0; i < t_dataset.length; i++){
                            //         if(t_weights[i] == 0)
                            //             continue;
                            //         t_data.push(mul(sub(t_dataset[i], v_point), t_weights[i]));
                            //     }
                            // break;
                        }
                    }else{
                        t_matrix = dot(trans(t_dataset), t_dataset);
                        //PCA & reverse PCA
                    }
                    // if(norm1(t_matrix) < 1e-10)
                    //     return false;
                    // Config.set("test", t_matrix);
                    t_cord = MDS.getCoordinatesByEigen(t_dataset, t_matrix, (v_opti == "Expand"));
                    break;
                    case "Separate":
                    var t_target = [], t_others = [];
                    for(var i = 0; i < t_dataset.length; i++){
                        if(v_inds.indexOf(i+'')>=0 || v_inds.indexOf(i)>=0){
                            t_target.push(t_dataset[i]);
                        }else{
                            t_others.push(t_dataset[i]);
                        }
                    }
                    if(Config.get("useCentroid")){
                        var t_centroid;
                        for(var i in t_target){
                            if(!t_centroid){
                                t_centroid = t_target[i];
                            }else{
                                t_centroid = add(t_centroid, t_target[i]);
                            }
                        }
                        t_centroid = div(t_centroid, t_target.length);
                        for(var i = 0; i < t_others.length; i++){
                            t_data.push(sub(t_others[i], t_centroid));
                        }
                        t_matrix = dot(trans(t_data), t_data);
                    }else{
                        var t_target = [], t_others = [];
                        for(var i = 0; i < t_dataset.length; i++){
                            if(v_inds.indexOf(i+'')>=0){
                                t_target.push(t_dataset[i]);
                            }else{
                                t_others.push(t_dataset[i]);
                            }
                        }
                        for(var t = 0; t < t_target.length; t++){
                            t_point = t_target[t];
                            t_data = [];
                            for(var i = 0; i < t_others.length; i++){
                                t_data.push(sub(t_others[i], t_point));
                            }
                            if(!t_matrix){
                                t_matrix = dot(trans(t_data), t_data);
                            }else{
                                var tt_matrix = dot(trans(t_data), t_data);
                                t_matrix = add(t_matrix, tt_matrix);
                            }
                        }
                    }
                    // if(norm1(t_matrix) < 1e-10)
                    //     return false;
                    var t_cord = MDS.getCoordinatesByEigen(t_dataset, t_matrix, true);
                    break;
                }
                return t_cord;
            },

            getFocusData: function(v_data, v_index){
                if(v_index.length == 0){
                    return v_data;
                }else{
                    var t_data = [];
                    for(var i in v_index){
                        t_data.push(v_data[v_index[i]]);
                    }
                    return t_data;
                }
            },

            coordEachPoint: function(){
                var t_cords = [], self = this, t_data = this.data.dataArray, t_cof = 1/Math.sqrt(2), t_vectors = [];
                var t_opti = Config.get("optimization");
                if(this.get("distType") == "KNN"){
                    var t_dim = dim(t_data);
                    this.set("distK", t_dim[1]);
                }
                for(var i in t_data){
                    var t_cord = trans(self.getCoordinatesWithSubspace([i], t_opti), null), t_s = 1;
                    t_cords[i] = t_cord;
                // t_vectors[i] = mul(add(t_cord[0], t_cord[1]), t_cof);
                if(dot(t_data[i], t_cord[0])<0)
                    t_s = -1;
                t_vectors[i] = mul(t_cord[0],t_s);
            }
            Config.get("data").vectors = t_vectors;
            Config.get("data").coordinates = t_cords;
            // self.viewpointcollection.updateVPMap();
        },

        setExtent: function(v_data){
            var t_max = 0, t_min = Infinity;
            for(var i in v_data){
                var t_norm = norm2(v_data[i]);
                if(t_norm>t_max)
                    t_max = t_norm;
                if(t_norm<t_min)
                    t_min = t_norm;
            }
            Config.get("data").max = t_max;
            Config.get("data").min = t_min;
        },

        showViewpoint: function(v_opt){
            Config.set("optimization", v_opt.opti);
            Config.set("currentColor", v_opt.color);
            if(v_opt.focus.length == 0){
                this.trigger("DataCenter__changeOpti", {state: v_opt.opti, disable: ['Separate']});
                this.setSuggestion("None");
            }else{
                this.trigger("DataCenter__changeOpti", {state: v_opt.opti, disable: []});
            }
            this.viewpointcollection.showViewpoint(v_opt);
        },

        addFocus: function(v_focus, v_cord, v_opti){
            var t_id = this.viewmapcollection.addFocus({
                group: v_focus,
            });
            if(t_id !=0 && !t_id){
                alert("Focus Already Exists!");
                return;
            }
            var t_types = Config.get("optimizationTypes"), t_cord;
            for(var i in t_types){
                if(t_types[i] == v_opti || (v_focus.length == 0 && t_types[i] == "Separate"))
                    continue;
                t_cord = this.getCoordinatesWithSubspace(v_focus, t_types[i], null);
                var t_sucess = this.viewmapcollection.addViewpoint(v_focus, t_cord, t_types[i]);
            }
            this.viewmapcollection.addViewpoint(v_focus, v_cord, v_opti);
        },

        getVPMapProjection: function(v_cords){
            var t_distMatrix = this.cordDistance(v_cords);
            var t_projection = MDS.byDistance(t_distMatrix);
            this.viewmapcollection.getProjection(t_projection);
        },

        cordDistance: function(v_cords){
            var self = this, t_dist = [], t_length = v_cords.length, t_distType = Config.get("cordDistType");
            for(var i = 0; i < t_length; i++){
                t_dist.push([]);
            }
            for(var i = 0; i < t_length; i++){
                t_dist[i][i] = 0;
                for(var j = i+1; j < t_length; j++){
                    var tt_dist = self.getCordDistance(t_distType, trans(v_cords[i]), trans(v_cords[j]));
                    t_dist[i][j] = tt_dist;
                    t_dist[j][i] = tt_dist;
                }
            }
            return t_dist;
        },

        getCordDistance: function(v_distType, v_cord1, v_cord2){
            var t_dist = 0;
            switch(v_distType){
                case "Chordal":
                var t_d = sub(dot(v_cord1, trans(v_cord1)), dot(v_cord2, trans(v_cord2)));
                t_d.forEach(function(tt_d){
                    t_dist += norm2Squared(tt_d);
                });
                t_dist = t_dist/Math.sqrt(2);
                break;
                case "Binet–Cauchy":
                var t_d = 1-Math.pow(det(dot(v_cord1, trans(v_cord2))),2);
                if(t_d<1e-10)
                    t_d = 0;
                t_dist = Math.sqrt(t_d);
                break;
            }
            return t_dist;
        },

        showClusters: function(v_cord){
            var t_data = dot(this.data.dataArray, v_cord);
            var t_cluster = this.data.clustering(t_data);
        },

        showFocus: function(v_focus, v_col){
            Config.set("currentColor", v_col);
            if(v_focus.length == 0){
                this.setSuggestion("None");
            }
            this.viewpointcollection.chooseFocus(v_focus);
        },

        highlightData: function(v_data, v_sign, v_color){
            this.viewpointcollection.highlightData(v_data, v_sign, v_color);
        },

        changeDataColor: function(v_data, v_col){
            Config.set("currentColor", v_col);
            this.viewpointcollection.changeDataColor(v_data, v_col);
        },

        showTitlePicker: function(v_pos, v_from, v_text){
            var self = this;
            $("#titlePicker")[0].value = v_text;
            d3.select("#titlePickerDiv")
            .style('left', function(){
                return v_pos[0] + 'px';
            })
            .style('top', function(){
                return v_pos[1] + 'px';
            })
            .style('display', 'block')
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .style("opacity", 1);
        },

        hideTitlePicker: function(v_sign){
            var self = this, t_id = Config.get("changeTitleID");
            d3.select("#titlePickerDiv")
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .style("opacity", 0);
            setTimeout(function(){
                d3.select("#titlePickerDiv")
                .style('display', 'none');
            }, self.transition.duration);
            if(t_id && v_sign){
                var t_text = $("#titlePicker")[0].value;
                self.viewmapcollection.changeFocusTitle(t_id, t_text);
            }else{
                self.viewmapcollection.cancelFocusTitle();
            }
        },

        holdTitlePicker: function(v_state){
            var self = this;
            if(v_state){
                d3.select("#titlePickerDiv")
                .interrupt()
                .transition()
                .style("opacity", 1);
            }else{
                var t_dur = self.transition.duration * 2.5;
                d3.select("#titlePickerDiv")
                .interrupt()
                .transition()
                .duration(t_dur)
                .style("opacity", 0);
                return t_dur;
            }
        },

        removeTitlePicker: function(){
            d3.select("#titlePickerDiv")
            .style("display", "none");
            this.viewmapcollection.cancelFocusTitle();
        },

        showColorPicker: function(v_pos, v_from, v_col, v_callback)
        {
            var self = this;
            Config.set("colorFrom",v_from);
            Config.set('colorInPicker', v_col);
            d3.select('#' + self.colorPickerDiv)
            .style('left', function(){
                return v_pos[0] + 'px';
            })
            .style('top', function(){
                return v_pos[1] + 'px';
            })
            .style('display', 'block')
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .style("opacity", 1);
            d3.select("#colorPickerContainer")
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .style("display", "block")
            .style("opacity", 1);
            var t_picker = document.getElementById(self.colorPicker);
            t_picker.jscolor.fromString(v_col.slice(1, v_col.length));
            t_picker.jscolor.show();
            self.fixColorPicker(v_callback);
        },

        changeColor: function(color)
        {
            var self = this;
            Config.set('colorInPicker', color);
        },

        hideColorPicker: function(v_sign)
        {
            var self = this, t_id = Config.get("changeColorID");
            self.colorPickerTransition(false);
            setTimeout(function(){
                d3.select('#' + self.colorPickerDiv)
                .style('display', 'none');
                document.getElementById(self.colorPicker).jscolor.hide();
                d3.select("#colorPickerContainer").classed("hidden", true);
            }, self.transition.duration);
            self.shown = false;
            Config.set("colorPickerLeft", null);
            if(t_id && v_sign){
                self.viewmapcollection.changeFocusColor(t_id, Config.get("colorInPicker"));
            }else{
                self.viewmapcollection.cancelFocusColor();
            }
        },

        fixColorPicker: function(v_callback){
            var self = this, t_picker = d3.select("#" + self.colorPickerDiv);
            var t_colors = $("#colorScript+div"), t_left, t_width, t_top, t_height;
            if(!this.ready){
                this.ready = true;
                t_top = parseFloat(t_colors.css("top"));
                t_colors.css("top", t_top + 6 + "px");
                t_picker.selectAll("button").attr("class", "btn btn-default btn-sm");
                t_picker.select("input").attr("type", "text").style("width", "88px");
                $("#"+self.colorPicker).on("click", function(){
                    self.fixColorPicker();
                });
            }
            if(!this.shown){
                var tt_left = parseFloat(t_picker.style("left"));
                Config.set("colorPickerLeft", tt_left - 0.1);
                t_picker.style("left", tt_left + 6 + 'px');
                t_width = parseFloat(t_colors.css("width"));
                t_height = parseFloat(t_colors.css("height"));
                t_left = parseFloat(t_colors.css("left"));
                t_top = parseFloat(t_colors.css("top"));
                var t_container = $("#colorPickerContainer");
                t_container.css("left", t_left - 5 + 'px');
                t_container.css("top", t_top - 42 + 'px');
                t_container.css("width", t_width + 9 + 'px');
                t_container.css("height", t_height + 37 + 'px');
                d3.select(t_container[0]).classed("hidden", false);
                self.colorPickerTransition(true);
                var t_objs = self.colorPickerObjs = [t_container[0], t_picker.node(), t_colors[0]];
                if(v_callback){
                    for(var i in t_objs){
                        d3.select(t_objs[i])
                        .on("mouseover", function(){
                            v_callback(false);
                        })
                        .on("mouseout", function(){
                            v_callback(true);
                        });
                    }
                }
            }
            this.shown = true;
        },

        holdColorPicker: function(v_state){
            var self = this, t_objs = self.colorPickerObjs;
            if(v_state){
                for(var i in t_objs){
                    d3.select(t_objs[i])
                    .interrupt()
                    .transition()
                    .style("opacity", 1);
                }
            }else{
                var t_dur = self.transition.duration * 2.5;
                for(var i in t_objs){
                    d3.select(t_objs[i])
                    .interrupt()
                    .transition()
                    .duration(t_dur)
                    .style("opacity", 0);
                }
                return t_dur;
            }
        },

        removeColorPicker: function(){
            var t_objs = this.colorPickerObjs;
            this.hideColorPicker(false);
        },

        colorPickerTransition: function(v_sign){
            var self = this;
            var t_picker = d3.select("#" + self.colorPickerDiv);
            var t_colors = $("#colorScript+div"), t_left, t_width, t_top, t_height;
            var t_container = $("#colorPickerContainer");
            var t_opac = v_sign?1:0;
            t_picker
            .transition()
            .duration(self.transition.duration)
            .style("opacity", t_opac);
            d3.select(t_container[0])
            .transition()
            .duration(self.transition.duration)
            .style("opacity", t_opac);
            d3.select(t_colors[0])
            .transition()
            .duration(self.transition.duration)
            .style("opacity", t_opac);
        },

        getClusterCord: function(v_clusters, v_opti){
            var self = this, t_cords = [];
            for(var i in v_clusters){
                var t_cluster = v_clusters[i], tt_cord = [];
                tt_cord = self.getCoordinates(t_cluster, v_opti, Config.get("subspaceAll"));
                t_cords.push(tt_cord);
            }
            return t_cords;
        },

        releaseFocus: function(){
            Config.set("currentColor", Config.get("lightColor").dark);
            this.viewmapcollection.releaseFocus();
        },

        setSuggestion: function(v_state){
            this.trigger("DataCenter__changeSuggestion", v_state);
        },
    }))();
});
