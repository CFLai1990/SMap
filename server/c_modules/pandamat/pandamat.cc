#include "pandamat.h"

PandaMat::PandaMat(){
	expTypes.insert(pair<string, int>("type", 0));
	stateCode = sucess;
}

void PandaMat::unpackArray(Local<Value> v_arr, parameterType& v_type, mat& v_data){
	int t_rows = 0, t_cols = 0;
	if(v_arr -> IsArray()){
		Local<Array> v_arr_i = Local<Array>::Cast(v_arr);
		t_rows = v_arr_i -> Length();
		Local<Value> v_ele_j = v_arr_i->Get(0);
		if(v_ele_j -> IsArray()){
			Local<Array> v_arr_j = Local<Array>::Cast(v_ele_j);
			t_cols = v_arr_j -> Length();
		}
	}
	if(t_rows != 0 && t_cols != 0){
		Local<Array> v_arr_i = Local<Array>::Cast(v_arr);
		v_data = mat(t_rows,t_cols);
		for(int i = 0; i < t_rows; i++){
			Local<Array> v_arr_j = Local<Array>::Cast(v_arr_i->Get(i));
			for(int j = 0; j < t_cols; j++){
				double v_element = v_arr_j -> Get(j) -> NumberValue();
				v_data(i, j) = v_element;
			}
		}
	}else{
		stateMessage = "Not a matrix!";
		throw exceptions(typeError);
	}
}

mat PandaMat::getResult(OperationResult& v_result){
	if(v_result.stateCode == sucess){
		return v_result.result;
	}else{
		stateMessage = v_result.message;
		throw exceptions(v_result.stateCode);
	}
}

bool PandaMat::getState(){
	bool t_state = false;
	switch(stateCode){
		case sucess:
		t_state = true;
		stateMessage.insert(0, "Sucess!");
		break;
		case typeError:
		stateMessage.insert(0, "Type error: ");
		break;
		case operationError:
		stateMessage.insert(0, "Operation error: ");
		break;
		default:
		stateMessage.insert(0, "Unknown error: ");
		break;
	}
	return t_state;
}

void PandaMat::packArray(mat& v_data){
	int t_size[2] = {(int)v_data.n_rows, (int)v_data.n_cols};
	resultMat = Array::New(isolate);
	for(int i = 0; i < t_size[0]; i++){
		Local<Array> vv_result = Array::New(isolate);
		for(int j = 0; j < t_size[1]; j++){
			vv_result->Set(j, Number::New(isolate, v_data(i,j)));
		}
		resultMat->Set(i, vv_result);
	}
}

Local<Object> PandaMat::packResult(mat& v_data){
	Local<Object> t_result = Object::New(isolate);
	bool t_state = getState();
	t_result -> Set(String::NewFromUtf8(isolate, "state"), Boolean::New(isolate, t_state));
	t_result -> Set(String::NewFromUtf8(isolate, "message"), String::NewFromUtf8(isolate, stateMessage.c_str()));
	packArray(v_data);
	t_result -> Set(String::NewFromUtf8(isolate, "result"), resultMat);
	return t_result;
}

Local<Value> PandaMat::Operate(const FunctionCallbackInfo<Value>& v_args, char* v_command, Isolate* v_isolate){
	isolate = v_isolate;
	mat t_retArr;
	try{
		Operation* v_opr = operations.find(v_command);
		for(int i = 0; i < v_opr->parameterNum; i++){
			parameterType t_type = v_opr->parameterTypes[i];
			mat t_data;
			switch(t_type){
				case 0:
				unpackArray(v_args[i], t_type, t_data);
				v_opr->data[i] = t_data;
				break;
				case 1:
				break;
				case 2:
				break;
			}
		}
		t_retArr = getResult(v_opr->operate());
		Local<Object> result = packResult(t_retArr);
		return result;
	}
	catch(exceptions& e){
		stateCode = e;
		Local<Object> result = packResult(t_retArr);
		return result;
	}
}