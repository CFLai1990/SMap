#ifndef PANDAMAT_OPERATIONCOLLECTION_H
#define PANDAMAT_OPERATIONCOLLECTION_H
#include <iostream>
#include <stdlib.h>
#include <string>
#include <node.h>
#include <v8.h>
#include <armadillo>
#include "operation.h"
#include "add.h"

class OperationCollection{
public:
	Operation* find(const char * v_operName);
protected:
	Add oprAdd;
};
#endif