/**
 * Created by Chufan Lai at 2015/12/14
 * model for the viewpoint map
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'viewpoint',
], function(require, Mn, _, $, Backbone, Viewpoint) {
    'use strict';

    var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv;

    var viewmap = Backbone.Collection.extend({
        model: Viewpoint,

        initialize: function(){
            var t_defaults = {
                count: 0,
                data: null,
                cordDist: null,
                viewpoint: null,
                distType: null,
                updateVPID: null,
                shownArray: [],
                waitCords: null,
            };
            _.extend(this, t_defaults);
        },

        clearAll: function(){
            this.reset();
            var t_defaults = {
                count: 0,
                data: null,
                cordDist: null,
                viewpoint: null,
                distType: null,
                updateVPID: null,
                shownArray: [],
            };
            _.extend(this, t_defaults);
            this.distType = Config.get("cordDistType");
            this.count = 0;
            this.trigger("ViewpointCollection__ClearAll");
            console.info("ViewpointCollection: clear all viewpoints!");
        },

        InitializeViewpoints: function(v_coordinates){
            // this.addViewpoint(v_coordinates, "shown");
            this.waitCords = v_coordinates;
            this.trigger("ViewpointCollection__GetPosition", this.shownArray.length);
        },

        addViewpoint: function(v_coordinates, v_state, v_layout){
            this.shownArray.push(this.count);
            this.add({id: this.count, center: null, coordinates: v_coordinates, state: v_state, index: this.count, layout: v_layout});
            this.trigger("ViewpointCollection__AddViewpoint", this.get(this.count));
            this.updateVPID = this.count;
            this.count++;
        },

        setData: function(v_data){
            this.data = v_data;
            // this.model
        },

        shiftFocus: function(){
        },

        getProjection: function(v_id, v_cord){
            var t_proj = numeric.dot(this.data, v_cord), t_vp = [];
            // for(var i in this.data[0]){
            //     t_vp.push(0);
            // }
            this.get(v_id).getProjection(v_cord, t_proj, t_vp);//Initialize viewpoint: origin point
        },

        getCoordinates: function(v_cord, v_vp, v_opti) {
            var t_model = this.get(this.updateVPID);
            this.focus = v_vp;
            t_model.updateCoordinates(this.data, v_cord, this.focus, v_opti);
            // t_model.getProjection(numeric.dot(this.viewpoint, v_cord), t_proj);
        },

        showErrors: function(v_vp, v_errors){
            var t_info = [], t_data = this.data;
            for(var i in t_data){
                var t_dist = numeric.norm2(numeric.sub(t_data[i], v_vp));
                t_info.push({id: i, distance: t_dist, error: v_errors[i]});
            }
            this.trigger("ViewpointCollection__ShowErrors", t_info);
        },

        updateVPMap: function(){
            var t_cords = Config.get("data").coordinates;
            this.trigger("ViewpointCollection__updateMap", t_cords);
        },

        showViewpoint: function(v_options){
            var t_id = v_options.id, t_cord = v_options.coordinate, t_state = v_options.state, t_opti = v_options.opti,
            v_vp;//v_vp = v_options.viewpoint ---- Do not allow focus in empty space
            if(t_state == "Point"){
                if(t_id)
                    v_vp = this.data[t_id];
                this.getCoordinates(t_cord, [v_vp], t_opti);
            }else{
                this.getCoordinates(t_cord, v_options.focus, t_opti);
            }
        },

        getVCDistances: function(v_id){
            this.trigger("ViewpointCollection__GetDistances", this.data[v_id]);
        },

        getPosition: function(v_layout){
            this.addViewpoint(this.waitCords, "shown", v_layout);
        },

        chooseFocus: function(v_focus, v_col){
            this.trigger("ViewpointCollection__updateProjectionByGroup", {id: 0}, v_focus);
        },

        highlightData: function(v_data, v_sign, v_color){
            this.trigger("ViewpointCollection__highlight", {data: v_data, state: v_sign, color: v_color});
        },

        changeDataColor: function(v_data, v_color){
            this.trigger("ViewpointCollection_changeDataColor", {data: v_data, color: v_color});
        },
    });
    return viewmap;
});
