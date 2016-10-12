#include "opercollection.h"

Operation* OperationCollection::find(const char * v_operName){
	string t_name(v_operName);
	if(t_name == "add"){
		parameterType t_types[2] = {p_matrix, p_matrix};
		oprAdd = Add(2, t_types);
		return &oprAdd;
	}
}