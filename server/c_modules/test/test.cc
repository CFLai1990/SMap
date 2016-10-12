#include <iostream>  
#include <stdlib.h>
#include <node.h>
#include <v8.h>
#include <armadillo>
  
using namespace std;
using namespace node;
using namespace v8;
using namespace arma;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;

void unpackArray(Local<Value> v_arr, int (&v_size)[2], mat& v_data){
	int t_rows = 0, t_cols = 0;
	if(v_arr -> IsArray()){
	    Array* v_arr_i = Array::Cast(* v_arr);
	    t_rows = v_arr_i -> Length();
	    Local<Value> v_ele_j = v_arr_i->Get(0);
	    if(v_ele_j -> IsArray()){
	    	Array* v_arr_j = Array::Cast(* v_ele_j);
	    	t_cols = v_arr_j -> Length();
	    }
	}
	v_size[0] = t_rows;
	v_size[1] = t_cols;
	if(t_rows != 0 && t_cols != 0){
		Array* v_arr_i = Array::Cast(* v_arr);
		v_data = mat(t_rows,t_cols);
		for(int i = 0; i < t_rows; i++){
		    Array* v_arr_j = Array::Cast(* (v_arr_i->Get(i)));
			for(int j = 0; j < t_cols; j++){
				double v_element = v_arr_j -> Get(j) -> NumberValue();
				v_data(i, j) = v_element;
			}
		}
	}
}

void PackArray(Isolate* v_isolate, Local<Object>& v_result, mat& v_data, int (&v_size)[2]) {
	char t_str[10];
	for(int i = 0; i < v_size[0]; i++){
		Local<Object> vv_result = Object::New(v_isolate);
		for(int j = 0; j < v_size[1]; j++){
		  	vv_result->Set(String::NewFromUtf8(v_isolate, itoa(j, t_str, 10)), Number::New(v_isolate, v_data(i,j)));
		}
	  vv_result->Set(String::NewFromUtf8(v_isolate, "length"), Integer::New(v_isolate, v_size[1]));
	  v_result->Set(String::NewFromUtf8(v_isolate, itoa(i, t_str, 10)), vv_result);
	}
  v_result->Set(String::NewFromUtf8(v_isolate, "length"), Integer::New(v_isolate, v_size[0]));
}

void Method(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  Local<Object> result = Object::New(isolate);

  int size[2];
  mat data;
  unpackArray(args[0], size, data);
  if(size[0] == 0 || size[1] == 0){
  	return args.GetReturnValue().Set(Exception::TypeError(String::NewFromUtf8(isolate, "Not a matrix!")));
  }
  PackArray(isolate, result, data, size);
  args.GetReturnValue().Set(result);
}

void init(Local<Object> target) {
  NODE_SET_METHOD(target, "test", Method);
}

NODE_MODULE(test, init);