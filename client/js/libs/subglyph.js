(function () {
    'use strict';
    window['SubGlyph'] = {
    	init: function(v_r, v_maxR, v_mapType, v_glyphType, v_colors){
    		let t_init = {
    			r: v_r * 2 * Math.sqrt(3) / 3,
    			maxR: v_maxR,
    			mapType: v_mapType,
    			glyphType: v_glyphType,
    			strokeThin: 0,
    			strokeThick: 4,
    			fanAngleRatio: 0.3,
                colors: v_colors,
                filterer: null,
                filterSettings: {
                    container: null,
                    overallSelector: ".SubMapGrids",
                    controlAttr: "opacity",
                    overallFilterFunc: (v_d) => {return v_d.id != null;},
                    getFilterFunc: () => {},
                    animation: () => {},
                },
    		};
    		Object.assign(this, t_init);
    	},

        getRectGlyph: function(v_dimLength, [v_width, v_height], v_className, v_type){
            class rectGlyph{
                constructor(v_dimLength, [v_width, v_height], v_className, v_type){
                    this.size = [v_width, v_height];
                    this.className = v_className;
                    this.glyphWidth = v_width * 0.8 / (v_dimLength + (v_dimLength + 1) * 0.125);
                    this.glyphHeight = v_height * 0.8;
                    this.glyphSize = Math.min(this.glyphWidth, this.glyphHeight);
                    this.marginWidth = (v_width - v_dimLength * this.glyphSize) / (v_dimLength + 1);                    
                    this.marginHeight = (v_height - this.glyphSize) / 2;
                };
                show(v_g, v_dims){
                    let t_marginWidth = this.marginWidth,
                        t_glyphSize = this.glyphSize;
                    v_g
                    .selectAll("." + this.className)
                    .data(v_dims)
                    .enter()
                    .append("g")
                    .attr("class", v_className)
                    .attr("transform", (v_dim, v_i) => {
                        return "translate(" + [(t_glyphSize + t_marginWidth) * v_i + this.marginWidth, this.marginHeight] + ")";
                    })
                    .each(function(v_dim){
                        switch(v_type){
                            case "rectangle":
                                d3.select(this)
                                .classed("empty", v_dim == 0)
                                .append("rect")
                                .attr("x", 0)
                                .attr("y", 0)
                                .attr("width", t_glyphSize)
                                .attr("height", t_glyphSize);
                            break;
                            case "circle":
                                let t_r = t_glyphSize / 2;
                                d3.select(this)
                                .classed("empty", v_dim == 0)
                                .append("circle")
                                .attr("cx", t_r)
                                .attr("cy", t_r)
                                .attr("r", t_r);
                            break;
                        }
                    });
                };
            };
            return new rectGlyph(v_dimLength, [v_width, v_height], v_className, v_type);
        },

    	showFrames: function(vv_g, vv_path, vv_col, vv_opa){                            
            vv_g.append("path")
            .classed("metaGlyph", true)
            .classed("fill", true)
            .attr("d", vv_path)
            .attr("fill", vv_col)
            .attr("fill-opacity", vv_opa)
            .classed("cell", true);
        },

        showBoundaries: function(vv_g, vv_nghDist, vv_r, vv_empty){                            
            vv_g.selectAll("line")
            .data(vv_nghDist)
            .enter()
            .append("g")
            .attr("class", "gridEdge")
            .attr("transform", v_ngh => {
                return "rotate("+(v_ngh.angle / Math.PI * 180)+")";
            })
            .append("line")
            .attr("x1", vv_r * Math.sqrt(3)/2)
            .attr("x2", vv_r * Math.sqrt(3)/2)
            .attr("y1", vv_r * 0.5)
            .attr("y2", -vv_r * 0.5)
            .attr("opacity", v_ngh => {
                if(v_ngh.dist == null){
                    if(vv_empty){
                        return 0.2;
                    }else{
                        return 1.0;
                    }
                }else{
                    return (v_ngh.dist);
                    // return 1.0;
                }
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", v_ngh => {
                if(v_ngh.dist == null){
                    if(vv_empty){
                        return this.strokeThin + "px";
                    }else{
                        return "0px";//this.strokeThick;
                    }
                }else{
                    return v_ngh.dist * 0.9 * this.strokeThick + "px";
                }
            });
        },

        showStick: function(vv_g, vv_dims){
            let t_div = Math.PI * 2 / vv_dims.length;
            for(let i = 0; i < vv_dims.length; i++){
                let tt_ang = t_div * i;
                vv_g.append("line")
                .attr("class", "weights")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", this.maxR * 0.8 * vv_dims[i] * Math.cos(tt_ang))
                .attr("y2", this.maxR * 0.8 * vv_dims[i] * Math.sin(tt_ang));
            }
        },

        showFan: function(vv_g, vv_dims, vv_id, vv_col, v_inR, v_outR, v_pattern = false, v_weights = null, v_ext = null){
	            let t_div = Math.PI * 2 / vv_dims.length,
                    t_this = this,
	                t_dimArc = d3.svg.arc()
	                .outerRadius(v_outR)
	                .innerRadius(v_inR)
	                .startAngle(- t_div * this.fanAngleRatio)
	                .endAngle(t_div * this.fanAngleRatio);
	            for(let i = 0; i < vv_dims.length; i++){
	                let tt_ang = 360 / vv_dims.length * i;
	                vv_g.append("g")
	                .attr("class", "dimFan")
                    .classed("metaGlyph", true)
	                .attr("transform", "rotate(" + tt_ang + ")")
                    .attr("index", vv_id + "_" + i)
                    .attr("opacity", () => {
                        if(!v_pattern){
                            return 1;
                        }else{
                            return 0 + 0.9 * Math.pow(v_weights[i],3) / Math.pow(v_ext.max,3);
                        }
                    })
	                .append("path")
                    .classed("fill", (vv_dims[i] != 0))
	                .attr("d", t_dimArc())
	                .attr("fill", (vv_dims[i] == 0)?"none":vv_col)
	                .attr("stroke", function(){
                        let t_empty = !(d3.select(this).classed("fill"));
                        return v_pattern?(t_empty?vv_col:"none"):"none";
                    })//v_weights == null?"none":"#666")
                    .attr("stroke-width", function(){
                        let t_empty = !(d3.select(this).classed("fill"));
                        return v_pattern?(t_empty?t_this.strokeThin:"0px"):"0px";
                    });
                    // .attr("stroke-width", () => {
                    //     if(v_weights == null){
                    //         return 0;
                    //     }else{
                    //         return 0.5 + 1 * v_weights[i] / v_ext.max;
                    //     }
                    // });
	            }
	    },

	    showBridge: function(vv_g, vv_nghDist, vv_r, vv_col){
            let t_scale = vv_nghDist.diffScale;
			vv_g.selectAll(".subEdge")
            .data(vv_nghDist)
            .enter()
            .append("g")
            .attr("class", "subEdge")
            .attr("transform", v_ngh => {return "rotate(" + (v_ngh.angle / Math.PI * 180) + ")"})
            .call(vv_gs => {
                vv_gs[0].forEach(vvv_g =>{
                    let tt_ngh = d3.select(vvv_g).data()[0],
                        tt_isDiff = (tt_ngh.diff == null)?false:true;
                    if(!tt_isDiff){
                        return;
                    }
                    let tt_length = tt_isDiff?t_scale(tt_ngh.diff):null,
                        tt_spot1 = [vv_r, -tt_length * 0.5],
                        tt_spot2 = [vv_r, tt_length * 0.5],
                        tt_triangle = "M0 0" + " L" + tt_spot1.join(" ") + " L" + tt_spot2.join(" ") + " Z";
                        d3.select(vvv_g)
                        .attr("opacity", tt_ngh.dist)
                        .append("path")
                        .attr("d", tt_triangle)
                        .attr("fill", vv_col);
                        d3.select(vvv_g)
                        .append("line")
                        .attr("x1", 0)
                        .attr("x2", tt_spot1[0])
                        .attr("y1", 0)
                        .attr("y2", tt_spot1[1])
                        .attr("stroke-width", (tt_ngh.dist) * 3);
                        d3.select(vvv_g)
                        .append("line")
                        .attr("x1", 0)
                        .attr("x2", tt_spot2[0])
                        .attr("y1", 0)
                        .attr("y2", tt_spot2[1])
                        .attr("stroke-width", (tt_ngh.dist) * 3);
                });
            });
	    },

        initializeFilter: function(v_container){
            let t_filterer = this.filterer;
            if(t_filterer == null){
                this.filterSettings.container = v_container;
                this.filterer = t_filterer = BasicView.filter(this.filterSettings);
            }
            let t_animateFunc = (v_d3selection, v_fit) => {
                let t_ftOpc = v_fit?1:0.2;
                v_d3selection
                .attr("ftOpacity", t_ftOpc)
                .interrupt()
                .transition()
                .attr("opacity", function(){
                    let t_this = d3.select(this),
                        t_zgOpc = parseFloat(t_this.attr("zgOpacity")),
                        t_ptOpc = parseFloat(t_this.attr("ptOpacity"));
                    t_zgOpc = isNaN(t_zgOpc)?1.0:t_zgOpc;
                    t_ptOpc = isNaN(t_ptOpc)?1.0:t_ptOpc;
                    return t_zgOpc * t_ftOpc * t_ptOpc;
                });
            };
            this.filterSettings.getFilterFunc = (v_dimCover) => {
                let t_allLimits = v_dimCover.filter((v_d) => {return v_d >=0;}),
                    t_allCount = t_allLimits.length;
                if(t_allCount == 0){
                    return (v_grid) => {return true;}
                }else{
                    return (v_grid) => {
                        let t_grid = v_grid[0];
                        let t_code = t_grid.code, t_fitCount = 0, t_fit = true;
                        for(let i = 0; i < v_dimCover.length; i++){
                            if(v_dimCover[i] >=0 && t_code[i] == v_dimCover[i]){
                                t_fitCount++;
                            }
                        }
                        if(t_fitCount < t_allCount){
                            t_fit = false;
                        }
                        return t_fit;
                    };
                }
            };
            t_filterer.animation = t_animateFunc;
            t_filterer.init();
        },

        filterGlyphsByDims: function(v_container, v_dimCover){
            let t_filterer = this.filterer;
            if(t_filterer == null || !t_filterer.ready){
                this.initializeFilter(v_container);
            }
            let t_filterResult = this.filterer.filter("filterDims", "data", null, this.filterSettings.getFilterFunc(v_dimCover)),
                t_returnIDs = new Array(), t_returnIndeces = new Array();
            t_filterResult.each(function(v_grid){
                t_returnIDs.push(v_grid.id);
                t_returnIndeces.push(d3.select(this).attr("index"));
            });
            return {
                IDs: t_returnIDs,
                indeces: t_returnIndeces,
            };
        },

        filterGlyphsByIDs: function(v_container, v_ids){
            let t_filterer = this.filterer;
            if(t_filterer == null || !t_filterer.ready){
                this.initializeFilter(v_container);
                t_filterer = this.filterer;
            }
            if(v_ids != null){
                t_filterer.filter("filterIDs", "index", v_ids);
            }else{
                t_filterer.restore("filterIDs");
            }
        },

        pickGlyphsByIDs: function(v_container, v_ids){
            let t_filterer = this.filterer;
            if(t_filterer == null || !t_filterer.ready){
                this.initializeFilter(v_container);
                t_filterer = this.filterer;
            }
            if(v_ids != null){
                t_filterer.pick("pickIDs", "index", v_ids);
            }else{
                t_filterer.restore("pickIDs");
            }
        },

        changeGlyph: function(v_gs, v_pattern, v_weights){
            let t_this = this,
                t_ext = v_weights.extent;
            switch(this.mapType){
                case "cell":
                    switch(this.glyphType){
                        case "fill":
                        break;
                        case "stick":
                        break;
                        case "fan":
                            v_gs.selectAll(".dimFan")
                            .attr("ptOpacity", function(){
                                let t_index = d3.select(this).attr("index"),
                                    t_id, t_dim;
                                t_index = t_index.split("_");
                                t_id = t_index[0];
                                t_dim = t_index[1];
                                let t_weights = v_weights[t_id];
                                if(!v_pattern){
                                    return 1;
                                }else{
                                    return 0 + 0.9 * Math.pow(t_weights[t_dim],3) / Math.pow(t_ext.max,3);
                                }
                            })
                            .transition()
                            .attr("opacity", function(){
                                return d3.select(this).attr("ptOpacity");
                            });
                            v_gs.selectAll(".dimFan")
                            .select("path")
                            .transition()
                            .attr("stroke", function(){
                                let t_empty = !(d3.select(this).classed("fill"));
                                return v_pattern?(t_empty?"#000":"none"):"none";
                            })//v_weights == null?"none":"#666")
                            .attr("stroke-width", function(){
                                let t_empty = !(d3.select(this).classed("fill"));
                                return v_pattern?(t_empty?t_this.strokeThin:"0px"):"0px";
                            });
                        break;
                    }
                break;
            }
        },

        showGlyph: function(v_g, v_nghDist, v_id, v_dims, v_col, v_pattern = false, v_weights = null, v_ext = null){
            let v_isEmpty = (v_id == null),
                t_r = this.r;
            if(v_dims && v_dims.length){
                this.strokeThin = 4 / v_dims.length;
                this.strokeThick = 12 / v_dims.length;
            }else{
                this.strokeThin = 0.5;
                this.strokeThick = 4;
            }
            switch(this.mapType){
                case "cell":
                    switch(this.glyphType){
                        case "fill":
                            this.showFrames(v_g, d3.hexbin().hexagon(t_r), v_col, 0.8);
                            this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty);
                        break;
                        case "stick":
                            this.showFrames(v_g, d3.hexbin().hexagon(t_r), v_col, 0.8);
                            this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty);
                            if(t_r > 0 && v_dims && v_dims.length > 0){
                                	this.showStick(v_g, v_dims);
                            }
                        break;
                        case "fan":
                            this.showFrames(v_g, d3.hexbin().hexagon(t_r), (v_id==null)?"#000":v_col, (v_id==null)?0.2:0.4);
                            this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty);
                            if(!v_isEmpty && v_dims && v_dims.length > 0){
                                this.showFan(v_g, v_dims, v_id, "#000", t_r * 0.1, t_r * 0.8, v_pattern, v_weights, v_ext);
                            }
                        break;
                    }
                break;
                case "diff":
                    this.showFrames(v_g, d3.hexbin().hexagon(t_r), (v_id==null)?"#fff":v_col, 0.2);
                    this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty);
                    if(!v_isEmpty){
                    	this.showBridge(v_g, v_nghDist, this.maxR, v_col);
                    }
                break;
            }
            return v_g;
        },
    };
})();