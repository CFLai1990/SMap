(function () {        
    'use strict';
	String.prototype.visualLength = function(v_fontSize = 12)
    {
        let ruler = document.getElementById("ruler");
        if(ruler == null){
        	let t_ruler = document.createElement('span');
        	t_ruler.id = "ruler";
        	t_ruler.setAttribute("style", "font-size: " + v_fontSize + "px;visibility: hidden;");
        	document.body.append(t_ruler);
        	ruler = document.getElementById("ruler");
        }else{
	    	ruler.setAttribute("style", "font-size: " + v_fontSize + "px;visibility: hidden;");
        }
    	ruler.textContent = this;
        return [ruler.offsetWidth, ruler.offsetHeight];
    };
    window['HDPainter'] = {
    	init: function(v_g, v_obj){
    		let t_painter = {
    			initialize: function(){
    				return this.clearAll(v_g, v_obj);
		    	},

		        scaling: function(v_scales, v_data){
		            return [v_scales.x(v_data[0]), v_scales.y(v_data[1])];
		        },

		        getPointObj: function(){
		        	let t_this = this,
		        		t_point = {
		        			showData: function(){
		        				if(t_this.data == null || t_this.dimensions == null){
		        					return this;
		        				}
		        				let t_data = t_this.data,
		        					t_dimensions = t_this.dimensions,
		        					t_timer = t_this.hover.timer,
		        					t_delay = t_this.hover.delay,
		        					t_g = this
			        				.selectAll(".ProjectionPoint")
									.attr("data-html", true)
					                .attr("data-original-title", function(v_d, v_i){
					                    var t_text = "";
					                    t_dimensions.forEach(function(v_dim){
					                        t_text += v_dim+": "+t_data[v_i][v_dim]+"</br>";
					                    });
					                    return t_text;
					                })
					                .attr("data-placement", "bottom");
					                $(t_g[0]).tooltip({
					                    container: t_this.tooltipContainer,
					                    trigger: "manual",
					                });
					                t_g.on("mouseover", function(){
					                    clearTimeout(t_timer);
					                    t_timer = setTimeout(() => {
					                        $(this).tooltip("show");
					                    }, t_delay);
					                })
					                .on("mouseout", function(){
					                    clearTimeout(t_timer);
					                    t_this.hover.timer = null;
					                    $(this).tooltip("hide");
					                });
				                return this;
		        			},
			        		drawPoints: function(v_projection){
			        			if(!this.selectAll(".ProjectionPoint").empty()){
			        				return this.movePoints(v_projection);
			        			}
				    			this
				            	.selectAll(".ProjectionPoint")
				            	.data(v_projection)
				            	.enter()
				            	.append("g")
				            	.attr("class", "ProjectionPoint")
				                .attr("index", (t_d, t_i) => {
				                	return t_i;
				                })
				                .attr("transform", (t_d, t_i) => {
				                    return "translate(" + t_this.scaling(t_this.scale, t_d) + ")";
				                })
				                .append("circle")
				                .attr("cx", 0)
				                .attr("cy", 0)
				                .attr("r", t_this.pointSize)
				                .attr("fill", "#ccc");
				                return this.showData();
				    		},
				    		movePoints: function(v_projection){
				    			if(this.selectAll(".ProjectionPoint").empty()){
				    				return this;
				    			}
				    			this
				    			.selectAll(".ProjectionPoint")
				    			// .interrupt()
				    			.transition()
				    			.ease(t_this.transition.ease)
				    			.duration(t_this.transTime)
				                .attr("transform", function(t_d, t_i){
				                    return "translate(" + t_this.scaling(t_this.scale, v_projection[t_i]) + ")";
				                });
				    		},
			        	};
		    		return t_point;
		        },

		        getAxisObj: function(){
		        	let t_this = this,
		        		t_axis = {
		        			drawAxes: function(v_cords, v_start){
		        				if(!this.selectAll(".ProjectionAxis").empty()){
		        					return this.moveAxes(v_cords, v_start);
		        				}
		        				let t_axes = 
		        				this
		        				.selectAll(".ProjectionAxis")
				                .data(v_cords)
				                .enter()
				                .append("g")
				                .attr("class", "ProjectionAxis")
				                .attr("index", function(t_d, t_i){
				                    return t_i;
				                })
				                t_axes.append("line")
				                .attr("x1", t_this.scale.x(0))
				                .attr("y1", t_this.scale.y(0))
				                .attr("x2", function(t_d){ return t_this.scale.x(t_d[0] * t_this.axisLength.shorter);})
				                .attr("y2", function(t_d){ return t_this.scale.y(t_d[1] * t_this.axisLength.shorter);});
				               	if(t_this.dimensions){
				               		let t_dimensions = t_this.dimensions,
				               			t_scale = t_this.scale,
				               			t_fontSize = t_this.fontSize;
					                t_axes
					                .append("g")
					                .attr("class", "ProjectionAxisTitle")
					                .attr("index", function(t_d, t_i){
					                	return t_i;
					                })
					                .attr("opacity", function(t_d, t_i){
					                	return t_this.visibleDims[t_i]?1:0;
					                })
					                .append("text")
					                .attr("tlength", function(t_d, t_i){
					                    var t_text = t_dimensions[t_i];
					                    var t_size = t_text.visualLength(t_fontSize);
					                    return t_size.join(",");
					                })
					                .attr("x", function(t_d){
					                    var t_size = d3.select(this).attr("tlength").split(",");
					                    return t_scale.x(t_d[0] * t_this.axisLength.longer) - t_size[0] / 2;
					                })
					                .attr("y", function(t_d){
					                    var t_size = d3.select(this).attr("tlength").split(",");
					                    return t_scale.y(t_d[1] * t_this.axisLength.longer) + t_size[1] / 2;
					                })
					                .text(function(t_d, t_i){
					                    return t_dimensions[t_i];
					                });
				               	}
				               	return this;
		        			},
		        			moveAxes: function(v_cords, v_start){
		        				if(this.selectAll(".ProjectionAxis").empty()){
		        					return this;
		        				}
		        				let t_scale = t_this.scale,
		        				t_axes = this.selectAll(".ProjectionAxis");
		        				t_axes
		        				.select("line")
				    			// .interrupt()
				                .transition()
				                .ease(t_this.transition.ease)
				                .duration(t_this.transTime)
				                .attr("x2", function(t_d, t_i){ return t_scale.x(v_cords[t_i][0] * t_this.axisLength.shorter);})
				                .attr("y2", function(t_d, t_i){ return t_scale.y(v_cords[t_i][1] * t_this.axisLength.shorter);});
				               	if(t_this.dimensions){
				               		if(v_start){
					                    t_axes
					                    .selectAll(".ProjectionAxisTitle")
						                .transition()
						                .ease(t_this.transition.ease)
						                .duration(t_this.transition.duration)
					                    .style("opacity", function(t_d){
					                    	let t_index = $(this).attr("index");
					                    	return t_this.visibleDims[t_index]?1:0;
					                    });
					                }
					                t_axes.selectAll("text")
					    			// .interrupt()
					                .transition()
					                .ease(t_this.transition.ease)
					                .duration(t_this.transTime)
					                .attr("x", function(t_d){
				                    	let t_index = $($(this).parent()[0]).attr("index");
					                    var t_size = d3.select(this).attr("tlength").split(",");
					                    return t_scale.x(v_cords[t_index][0] * t_this.axisLength.longer) - t_size[0] / 2;
					                })
					                .attr("y", function(t_d){
				                    	let t_index = $($(this).parent()[0]).attr("index");
					                    var t_size = d3.select(this).attr("tlength").split(",");
					                    return t_scale.y(v_cords[t_index][1] * t_this.axisLength.longer) + t_size[1] / 2;
					                });
			               		}
			               	},
		               };
		        	return t_axis;
		        },

		        drawBiplot: function(v_projections, v_cords, v_interpolate = false){
		        	// this.stopAll();
		        	let t_getVisibleDims = (v_cords, v_threshold) => {
		        		let t_visible = new Array(v_cords.length);
		        		for(let i = 0; i < v_cords.length; i++){
		        			let t_cord = v_cords[i], t_length = 0;
		        			for(let j = 0; j < t_cord.length; j++){
		        				t_length += t_cord[j] * t_cord[j];
		        			}
		        			t_visible[i] = Math.sqrt(t_length) >= v_threshold;
		        		}
		        		return t_visible;
		        	};
		            let t_points = this.g.selectAll(".ProjectionPoints"),
		            	t_axes = this.g.selectAll(".ProjectionAxes");
		            this.interpolate = v_interpolate;
		            if(t_points.empty()){
		            	t_points = this.g.append("g").attr("class", "ProjectionPoints");
		            }
		            if(t_axes.empty()){
		            	t_axes = this.g.append("g").attr("class", "ProjectionAxes");
		            }
		            Object.assign(t_points, this.pointObj);
		        	Object.assign(t_axes, this.axisObj);
		            if(v_interpolate){
		            	this.transTime = this.transition.duration / this.interSteps;
		            	this.interNow = 0;
		            	this.visibleDims = t_getVisibleDims(v_cords[v_cords.length - 1], this.visibleLength);
		            	this.timer = setInterval(()=>{
		            		let t_projection = v_projections[this.interNow],
		            			t_cords = v_cords[this.interNow];
		            		t_points.drawPoints(t_projection);
		            		t_axes.drawAxes(t_cords, this.interNow == 0);
		            		this.interNow++;
		            		if(this.interNow == this.interSteps){
		            			clearInterval(this.timer);
		            			this.timer = null;
		            		}
		            	}, this.transTime);
		            }else{
		            	this.visibleDims = t_getVisibleDims(v_cords, this.visibleLength);
		            	this.transTime = this.transition.duration;
			            t_points.drawPoints(v_projections);
			            t_axes.drawAxes(v_cords, false);
		            }
		        },

		        setCanvas: function(v_g){
		        	this.g = v_g;
		        },

		        setData: function(v_data, v_dimensions){
		        	this.data = v_data,
		        	this.dimensions = v_dimensions;
		        },

		        stopAll: function(){
		        	if(this.g){
			        	this.g.selectAll("*")
			        	.interrupt();
			        	clearInterval(this.timer);
			        	this.timer = null;
		        	}
		        },

		        clearAll: function(v_g, v_obj){
		    		let t_cleanObj = {
		    			g: v_g,
		    			data: null,
		    			dimensions: null,
		    			canvasRange: [[0, 100], [0, 100]],
		                scale: {
		                    x: d3.scale.linear().range([0, 100]).domain([-0.3,0.3]),
		                    y: d3.scale.linear().range([0, 100]).domain([-0.3,0.3]),
		                },
		                tooltipContainer: null,
		                fontSize: 12,
		                pointSize: 6,
		                hoverDelay: 1500,
		                hover: {
		                    timer: null,
		                    delay: 1500,
		                    shown: null,
		                },
		                interpolate: false,
		                interSteps: null,
		                interNow: null,
		                timer: null,
		                visibleDims: null,
		                visibleLength: 1e-5,
		                transition: {
			                duration: 500,
			                ease: 'linear',
		                },
		                transTime: null,
		                pointObj: this.getPointObj(),
		                axisObj: this.getAxisObj(),
		                axisLength: {
		                	shorter: 0.3,
		                	longer: 0.32,
		                },
		    		}
		    		Object.assign(this, t_cleanObj);
		    		if(v_obj != null){
			    		Object.assign(this, v_obj);
			    		this.hover.delay = this.hoverDelay;
			    		this.scale.x.range(this.canvasRange[0]);
			    		this.scale.y.range(this.canvasRange[1]);
		    		}
		    		if(v_g != null){
		    			this.stopAll();
		    			v_g.selectAll("*").remove();
		    		}
		    		return this;
		        },
    		};
    		return t_painter.initialize();
    	}
    };
})();