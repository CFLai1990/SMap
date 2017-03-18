 define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'config',
    'variables',
    'data',
    'SubMap_Collection',
    'SubList_Collection',
    'Projection_Collection',
    'PandaMat',
    ], function(require, Mn, _, $, Backbone, Config, Variables, Data, SubMap_Collection, SubList_Collection, Projection_Collection, PandaMat){
        'use strict';

        var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

        return window.Datacenter = new (Backbone.Model.extend({
            defaults: function(){
                return {
                    data: null,
                    distType: null,
                };
            },

            initialize: function(url){
                var self = this;
                this.set("distType", Config.get("distType"));
                var t_default = {
                    ready: false,
                    shown: false,
                    transition: Config.get("transition"),
                };
                _.extend(this, t_default);
                this.data = new Data();
                this.SubMap_Collection = new SubMap_Collection();
                this.SubList_Collection = new SubList_Collection();
                this.Projection_Collection = new Projection_Collection();
                this.bindAll();
            },

            bindAll: function(){
                this.listenTo(this.data, "Data__DataReady", this.updateData);
                this.listenTo(this.data, "Data__Panda", this.panda);
                this.listenTo(this.SubMap_Collection, "SubMapCollection__Panda", this.panda);
                this.listenTo(this.SubMap_Collection, "Transmission", this.transmitInfo);
                this.listenTo(this.SubMap_Collection, "change:currentCls", this.transmitInfo);
                this.listenTo(this.SubList_Collection, "Transmission", this.transmitInfo);
                this.listenTo(this.Projection_Collection, "ProjectionCollection__Panda", this.panda);
                this.listenTo(this.Projection_Collection, "Transmission", this.transmitInfo);
            },

            start: function(){
                this.trigger("DataCenter__initialized");
                this.loadData(Config.get('dataPath'));
                this.temp_handle_mc();
            },

            temp_handle_mc: function(){
                let t_sensors, t_sensorBook = new Map(),
                    t_cars = new Array(), t_carGroup, t_carOrders,
                    t_nameBook, t_dimCount = 0, t_allData = new Array(), t_sameSequences;
                const t_group_hours = 25, t_all_hours = 24, t_group_num = 1;//~~(t_all_hours/t_group_hours);
                class mcNamebook{
                    constructor(v_sensors){
                        if(v_sensors != null){
                            this.init(v_sensors);
                        }
                    }
                    init(v_sensors){
                        this.count = t_dimCount;
                        let t_invNameBook = new Map();
                        for(let i = 0; i < v_sensors.length; i++){
                            let t_dims = v_sensors[i].dimensions,
                                t_name = v_sensors[i].name;
                            for(let j = 0; j < t_dims.length; j++){
                                t_invNameBook.set(parseInt(t_dims[j]), {
                                    gate: t_name,
                                    group: j,
                                });
                            }
                        }
                        this.nameBook = t_invNameBook;
                    };
                    translate(v_dimID){
                        let t_id = parseInt(v_dimID),
                            t_result = {
                                gate: null,
                                timerange: null,
                            };
                        if(t_id < 0 || t_id >= this.count){
                            return t_result;
                        }else{
                            let t_info = this.nameBook.get(t_id), t_range = [];
                            t_result.gate = t_info.gate;
                            t_result.timerange = [t_info.group * t_group_hours, (t_info.group + 1) * t_group_hours];
                            return t_result;
                        }
                    };
                };
                class mcSensors{
                    constructor(v_sensors){
                        this.namebook = new Map();
                        for(let i = 0; i < v_sensors.length; i++){
                            this.namebook.set(v_sensors[i].name, i);
                            let t_dims = new Array(t_group_num);
                            for(let j = 0; j < t_group_num; j++){
                                t_dims[j] = t_dimCount;
                                t_dimCount ++;
                            }
                            v_sensors[i].dimensions = t_dims;
                        }
                        this.sensors = v_sensors;
                        this.dimCount = t_dimCount;
                        t_nameBook = new mcNamebook(v_sensors);
                    };
                    getDimension(v_gate, v_hour){
                        let t_ind = this.namebook.get(v_gate);
                        if(t_ind == null){
                            return -1;
                        }else{
                            let t_hour = parseInt(v_hour);
                            if(t_hour < 0 || t_hour >= t_group_num){
                                return -1;
                            }else{
                                return this.sensors[t_ind].dimensions[v_hour];
                            }
                        }
                    };
                };
                class mcCar{
                    constructor(v_carid, v_infogroup){
                        this.id = v_carid;
                        this.type = v_infogroup[0]['car-type'];
                        this.getHistory(v_infogroup);
                    };
                    getHistory(v_infogroup){
                        this.history = new Array();
                        this.dimensions = new Array(t_dimCount).fill(0);
                        for(let i = 0; i < v_infogroup.length; i++){
                            let t_info = v_infogroup[i],
                                t_record = {
                                    gate: t_info['gate-name'],
                                    hour: t_info['hour'],
                                    time: t_info['time'].getTime(),
                                };
                            this.history.push(t_record);
                            let t_dimID = t_sensors.getDimension(t_record.gate, ~~(t_record.hour/t_group_hours));
                            this.dimensions[t_dimID]++;
                        }
                        this.dimensions = numeric.div(this.dimensions, numeric.sum(this.dimensions));
                    };
                };

                let temp_handle_sensors = (v_df) => {
                    d3.csv("data/mc1/mc1_sensor.csv", (v_d) => {
                        Config.set("mcsensors", v_d);
                        t_sensors = new mcSensors(v_d);
                        if(v_df != null){
                            v_df.resolve();
                        }
                    });
                },  temp_handle_cars = (v_df) => {
                    d3.csv("data/mc1/mc1_original.csv", (v_d) => {
                        for(let i = 0; i < v_d.length; i++){
                            let t_d = v_d[i];
                            t_d.time = new Date();
                            t_d.time.setTime(Date.parse(t_d.Timestamp));
                            t_d.hour = t_d.time.getHours();
                        }
                        t_carGroup = _.groupBy(v_d, (v_c) => {
                            let t_id = v_c['car-id'];
                            return t_id;
                            // return t_id.slice(15, t_id.length);
                        });
                        for(let i in t_carGroup){
                            t_cars.push(new mcCar(i, t_carGroup[i]));
                        };
                        Config.set("mccars", v_d);
                        if(v_df != null){
                            v_df.resolve();
                        }
                    });
                },  temp_handle_projection = (v_df) => {
                    for(let i = 0; i < t_cars.length; i++){
                        t_allData.push(t_cars[i].dimensions);
                    }
                    // temp_save_csv(t_allData);
                    let t_callback = (v_proj) => {
                        let t_projection = new Array(v_proj.length);
                        for(let i = 0; i < v_proj.length; i++){
                            t_projection[i] = [t_cars[i].id, ...v_proj[i]].join(",");
                        }
                        temp_save_csv(t_projection, "id,x,y");
                        if(v_df != null){
                            v_df.resolve();
                        }
                    };
                    temp_tsne(t_allData, 'panda', t_callback);
                },  temp_save_csv = (v_data, v_header) => {
                    let t_length = v_data.length,
                        t_csvContent = (v_header == null)?"":(v_header + "\n");
                    v_data.forEach((v_d, v_ind) => {
                        if(v_ind < t_length){
                            t_csvContent += v_d + "\n";
                        }else{
                            t_csvContent += v_d;
                        }
                    });
                    Basic.download(t_csvContent, "projection_" + t_group_num + "groups", "csv");
                },  temp_tsne = (v_data, v_method, v_callback) => {
                    if(v_callback == null){
                        v_callback = () => {};
                    }
                    let t_titles = "", t_sensorList = t_sensors.sensors;
                    for(let i = 0; i < t_sensorList.length; i++){
                        t_titles += (t_sensorList[i]['name'] + ",");
                    }
                    temp_save_csv(v_data, t_titles);
                    switch(v_method){
                        case "panda":
                            this.panda({
                                projType: "t-SNE",
                                projDim: 2,
                                projData: v_data,
                            }, "subProj = Projection(projData, projType, projDim)", v_callback, true, true);
                        break;
                        // case "js":
                        //     let opt = {}
                        //     opt.epsilon = 10; // epsilon is learning rate (10 = default)
                        //     opt.perplexity = 30; // roughly how many neighbors each point influences (30 = default)
                        //     opt.dim = 2; // dimensionality of the embedding (2 = default)
                        //     let tsne = new tsnejs.tSNE(opt);
                        //     tsne.initDataRaw(v_data);
                        //     for(let k = 0; k < 10; k++) {
                        //       tsne.step(); // every time you call this, solution gets better
                        //     }
                        //     let t_projection = tsne.getSolution(); // Y is an array of 2-D points that you can plot
                        //     v_callback(t_projection);
                        // break;
                    }
                },  temp_handle_orders = (v_df) => {
                    d3.csv("data/mc1/pca_result_ids.csv", (v_d) => {
                        let t_result_text = new Array(), t_result_obj = new Array();
                        for(let i = 0; i < v_d.length; i++){
                            let t_origin_id = v_d[i].id,
                                t_car_name = t_cars[t_origin_id].id;
                            t_result_obj.push({
                                id: t_origin_id,
                                value: v_d[i].value,
                            });
                            // t_result_text.push(t_car_name + "," + i);//v_d[i].value);
                        }
                        t_sameSequences = _.groupBy(t_result_obj, 'value');
                        let t_final_orders = new Array(), t_mid_orders = new Array(), t_final_text = new Array();
                        for(let t_value in t_sameSequences){
                            let t_car_ids = t_sameSequences[t_value];
                            if(t_car_ids.length >= 2){
                                let t_gates_sequence = _.map(t_car_ids, (v_car_item) => {
                                    let t_car_id = v_car_item.id,
                                        t_history = t_cars[t_car_id].history,
                                        t_min = Infinity, t_max = -Infinity;
                                    for(let i = 0; i < t_history.length; i++){
                                        let t_time = parseInt(t_history[i].time);
                                        if(t_time < t_min){
                                            t_min = t_time;
                                        }
                                        if(t_time > t_max){
                                            t_max = t_time;
                                        }
                                    }
                                    let t_history_byGates = _.groupBy(t_history, 'gate'), t_factor = 1 / (t_max - t_min),
                                        t_gate_sequence = _.map(t_history_byGates, (v_records, v_gate_name) => {
                                            let t_times = _.map(v_records, 'time');
                                            t_times.sort();// sort time through the same gate
                                            for(let i = 0; i < t_times.length; i++){
                                                t_times[i] = (t_times[i] - t_min) * t_factor;
                                            }
                                            return {
                                                name: v_gate_name,
                                                time: t_times,
                                            };
                                        }), t_result = new Array();
                                    t_gate_sequence = t_gate_sequence.sort((v_a, v_b) => {
                                        return v_a.name > v_b.name;
                                    });
                                    let t_timeline = _.map(t_gate_sequence, 'time'),
                                        t_dimension = new Array();
                                    for(let i = 0; i < t_timeline.length; i++){
                                        t_dimension.push(...t_timeline[i]);
                                    }
                                    return {
                                        id: t_car_id,
                                        time: t_dimension,//t_timeline,
                                    }
                                });
                                // t_gates_sequence = t_gates_sequence.sort((v_a, v_b) => {
                                //     let t_a_time = v_a.time, t_b_time = v_b.time,
                                //         t_div = 0, t_length = t_a_time.length;
                                //     for(let i = 0; i < t_length; i++){
                                //         t_div += d3.sum(t_a_time[i]) - d3.sum(t_b_time[i]);
                                //     }
                                //     return t_div;
                                // });
                                // let t_sub_order = _.map(t_gates_sequence, 'id');
                                if(t_gates_sequence.length == 2){
                                   t_gates_sequence = _.map(t_gates_sequence, 'id');
                                }
                                // let t_sub_order = _.map(t_gates_sequence, 'id');
                                t_mid_orders.push({
                                    value: parseFloat(t_value),
                                    orders: t_gates_sequence,//t_sub_order,
                                });
                            }else{
                                if(t_car_ids.length == 1){
                                    t_mid_orders.push({
                                        value: parseFloat(t_value),
                                        orders: [t_car_ids[0].id],
                                    });
                                }
                            }
                        }
                        t_mid_orders.sort((v_a, v_b) => {
                            return v_b.value - v_a.value;
                        });
                        let t_mid_new_orders = new Array(t_mid_orders.length);
                        for(let i = 0; i < t_mid_orders.length; i++){
                            let t_orders = t_mid_orders[i].orders;
                            if(t_orders.length <= 2){
                                t_mid_new_orders[i] = t_orders;
                            }else{
                                let t_sub_data = new Array();
                                for(let j = 0; j < t_orders.length; j++){
                                    t_sub_data.push(t_orders[j].time);
                                }
                                // console.log(t_sub_data);
                                t_sub_data = MDS.normalizeData(t_sub_data);
                                let t_values = (numeric.transpose(MDS.byData(t_sub_data)))[0],
                                    t_sort_inds = Basic.sortVector(t_values).index, t_sub_order = new Array();
                                for(let j = 0; j < t_sort_inds.length; j++){
                                    let t_index = t_sort_inds[j];
                                    t_sub_order.push(t_orders[t_index].id);
                                }
                                t_mid_new_orders[i] = t_sub_order;
                                // this.panda({
                                //     projType: "PCA",
                                //     projDim: 1,
                                //     projData: t_sub_data,
                                // }, "subProj = Projection(projData, projType, projDim)", (v_proj) => {
                                //     let t_sort_inds = Basic.sortVector(v_proj).index, t_sub_order = new Array();
                                //     for(let j = 0; j < t_sort_inds.length; j++){
                                //         t_sub_order.push(t_orders[j].id);
                                //     }
                                //     t_mid_new_orders[i] = t_sub_order;
                                //     t_df_finished[i].resolve();
                                // }, false, true);
                            }
                        }
                        for(let i = 0; i < t_mid_new_orders.length; i++){
                                t_final_orders.push(...t_mid_new_orders[i]);
                        }
                        for(let i = 0; i < t_final_orders.length; i++){
                            let t_index = t_final_orders[i],
                                t_car_name = t_cars[t_index].id;
                            t_final_text.push(t_car_name + "," + i);
                        }
                        // temp_save_csv(t_result_text, "id,value");
                        temp_save_csv(t_final_text, "id,order");
                        if(v_df != null){
                            v_df.resolve();
                        }
                        // for(let i = 0; i < t_mid_orders.length; i++){
                        //     t_final_orders.push(...t_mid_orders[i].orders);
                        // }
                        // for(let i = 0; i < t_final_orders.length; i++){
                        //     let t_index = t_final_orders[i],
                        //         t_car_name = t_cars[t_index].id;
                        //     t_final_text.push(t_car_name + "," + i);
                        // }
                        // // temp_save_csv(t_result_text, "id,value");
                        // temp_save_csv(t_final_text, "id,order");
                        // if(v_df != null){
                        //     v_df.resolve();
                        // }
                    });
                };

                let temp_handle_mc1 = function(){
                    let t_df_cars = $.Deferred(), t_df_sensors = $.Deferred(),
                        // t_df_projection = $.Deferred(),
                        t_df_order = $.Deferred();
                    temp_handle_sensors(t_df_sensors);
                    $.when(t_df_sensors).done(() => {
                        Config.set("sensors", t_sensors);
                        temp_handle_cars(t_df_cars);
                    });
                    $.when(t_df_cars).done(() => {
                        Config.set("cars", t_cars);
                        // temp_handle_projection(t_df_projection);
                        temp_handle_orders(t_df_order);
                    });
                    $.when(t_df_order).done(() => {

                    });
                },  temp_handle_mc2 = () =>{
                    d3.csv('data/mc1/dataWithTime.csv', (v_d) => {
                        let t_info = Basic.getHDData(v_d, 'time'),
                            t_titles = t_info.titles,
                            t_data = t_info.data,
                            t_indices = t_info.IDs;
                        t_data = MDS.normalizeData(t_data);
                        let t_callback = function(v_proj){
                            let t_projection = new Array(v_proj.length);
                            for(let i = 0; i < v_proj.length; i++){
                                let t_index = t_indices.get(i);
                                t_projection[i] = [t_index, ...v_proj[i]].join(",");
                            }
                            temp_save_csv(t_projection, "id,x,y");
                        };
                        this.panda({
                                    projType: "t-SNE",
                                    projDim: 2,
                                    projData: t_data,
                                }, "subProj = Projection(projData, projType, projDim)", t_callback, true, true);
                    });
                };

                // temp_handle_mc1();
                temp_handle_mc2();
            },

            loadData: function(v_path){
                var self = this;
                d3.csv(v_path, function(d){
                    self.data.update({
                        data: d,
                        dimensions: _.allKeys(d[0]),
                        sampling: false,
                    });
                });
            },

            updateData: function(){
                console.info("DataCenter: data ready!");
                var t_cord;
                Config.get("data").array = this.data.dataArray;
                Config.get("data").distances = MDS.getSquareDistances(this.data.dataArray);
                this.Projection_Collection.update();
                this.SubList_Collection.update();
                this.SubMap_Collection.update({
                    dimensions: this.data.dimensions.values(),
                    dimRange: Config.get("dimRange"),
                    sampleCount: Config.get("sampleCount"),
                });
            },

            transmitInfo: function(v_info){
                this.trigger(v_info.message, v_info.data);
            },

            requireFrom: function(v_source, v_attr){
                return this[v_source][v_attr];
            },

            listenAndTrigger: function(v_source, v_attr, v_message){
                this.listenTo(this[v_source], "change:" + v_attr, () => {
                    this.trigger(v_message, this[v_source][v_attr]);
                });
            },

            panda: function(v_data, v_command, v_callback, v_glb = true, v_return = false){
                let t_command = v_command;
                console.time(`PandaMat ${v_command}`);
                PandaMat.compute({
                    panda: {
                        data: v_data,
                        command: v_command,
                        global: v_glb,
                        return: v_return,
                    },
                    sucess: function(v_result){
                        console.timeEnd(`PandaMat ${v_command}`);
                        v_callback(v_result);
                    },
                    error: function(v_message){
                        console.timeEnd(`PandaMat ${v_command}`);
                        console.error(v_message);
                    },
                });
            },
    }))();
});
