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
    		};
    		Object.assign(this, t_init);
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

        filterGlyphs: function(v_gs, v_dimCover, v_filter){
            let t_return = new Array();
            if(v_filter){
                let t_acount = 0,
                    t_distScale = d3.scale.ordinal(),
                    t_col = this.colors;
                for(let i = 0; i < v_dimCover.length; i++){
                    if(v_dimCover[i] >= 0){
                        t_acount ++;
                    }
                }
                if(t_acount == 0){
                    t_distScale.domain([1, 0]).range([0.2, 1]);
                }else{                    
                    t_distScale.domain([1, 0]).range([0.2, 1]);
                }
                v_gs
                .each(function(v_grid){
                    if(v_grid.id != null){
                        let t_code = v_grid.code,
                            t_fcount = 0,
                            t_dist;
                        for(let i = 0; i < v_dimCover.length; i++){
                            let t_dim = v_dimCover[i];
                            if(t_dim >= 0){
                                if(t_dim == t_code[i]){
                                    t_fcount++;
                                }
                            }
                        }
                        if(t_fcount < t_acount){
                            t_dist = 1;
                        }else{
                            t_dist = 0;
                            t_return.push(v_grid.id);
                        }
                        d3.select(this)
                        .attr("opacity", t_distScale(t_dist * t_dist));
                    }
                });
            }else{
                v_gs
                .each(function(v_grid){
                    if(v_grid.id != null){
                        d3.select(this)
                        .attr("opacity", 1.0);
                    }
                });
            }
            return t_return;
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
                            .transition()
                            .attr("opacity", function(){
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
                this.strokeThin = 8 / v_dims.length;
                this.strokeThick = 12 / v_dims.length;
            }else{
                this.strokeThin = 1;
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