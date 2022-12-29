for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
        let cell = document.querySelector(`.cell[rid="${i}"][cid="${j}"]`);
        //The blur event fires when an element has lost focus.So let's say we are on A1 which has data 10 and now we moved to B1 so A1 fires blur event .We filled 20 in B1 and moved to another cell, let's say C3, so B1 fires blur event now. As soon as blur event is fired UI and DB of the cell will be updated which fired it.
        cell.addEventListener("blur", (e) => {
            let address = addressBar.value;
            let [activeCell, cellProp] = getCellAndCellProp(address);
            let enteredData = activeCell.innerText;
            if (enteredData == cellProp.value) return;
            cellProp.value = enteredData;
            //If data modifies remove P-C relation, formula empty, update children with new hardcoded(modified) value.
            removeChildFromParent(cellProp.formula);
            cellProp.formula = "";
            updateChildrenCells(address);
        })
    }
}
//In formula bar we filled some formula and hitted ENTER .The formula can be in form ( A1 + B1 ) or in form ( 10 + 20 ). The result will be evaluated and UI && DB of the cell(having blur event) whose address is in address-bar will be updated and result will be stored in it. eg C3 contains 30 now.
let formulaBar = document.querySelector(".formula-bar");
formulaBar.addEventListener("keydown", async (e) => {
    let inputFormula = formulaBar.value;
    if (e.key === "Enter" && inputFormula) {

        //If change in formula, break old P-C relation, evaluate new formula, add new P-C relation.
        let address = addressBar.value;
        let [cell, cellProp] = getCellAndCellProp(address);
        let oldFormula = cellProp.formula;
        if (inputFormula !== oldFormula)
            removeChildFromParent(oldFormula);

        addChildToGraphComponent(inputFormula, address);
        //Check formula is cyclic or not, then only evaluate
        let cycleResponse=isGraphCyclic(graphComponentMatrix);
        if(cycleResponse){
            let response=confirm("Your formula is cyclic.Do you want to trace your path?");
            while(response===true){
                //Keep on tracking color until user is satisified
                await isGraphCyclicTracePath(graphComponentMatrix,cycleResponse);  //I want to complete full iteration of color tracking, so i will attach wait here also.
                response=confirm("Your formula is cyclic.Do you want to trace your path?");
            }
            removeChildFromGraphComponent(inputFormula,address);
            return;
        }
        
        let evaluatedValue = evaluateFormula(inputFormula);

        //To update UI and cellProp in DB 
        setcellUIAndCellProp(evaluatedValue, inputFormula, address);
        addChildToParent(inputFormula);
        updateChildrenCells(address);
    }
})
function removeChildFromGraphComponent(formula,childAddress){
    let [crid, ccid] = decodeRIDCIDFromAddres(childAddress);
    let encodedFormula = formula.split(" ");
    for (let i = 0; i < encodedFormula.length; i++) {
        let asciiValue = encodedFormula[i].charCodeAt(0);
        if (asciiValue >= 65 && asciiValue <= 90) {
            let [prid, pcid] = decodeRIDCIDFromAddres(encodedFormula[i]);
            graphComponentMatrix[prid][pcid].pop();
        }
    }
}

function addChildToGraphComponent(formula, childAddress) {
    let [crid, ccid] = decodeRIDCIDFromAddres(childAddress);
    let encodedFormula = formula.split(" ");
    for (let i = 0; i < encodedFormula.length; i++) {
        let asciiValue = encodedFormula[i].charCodeAt(0);
        if (asciiValue >= 65 && asciiValue <= 90) {
            let [prid, pcid] = decodeRIDCIDFromAddres(encodedFormula[i]);
            //B1:A1+10
            //rid->i, cid->j
            graphComponentMatrix[prid][pcid].push([crid, ccid]);
        }
    }
}
//Eg. B1=A1+A2, C1=2*B1, C2=10*C1 where A1=10,A2=20  B1->30, C1->60, C2->600.  If B1 is now set to 20 then C1->40, C2->400. 
function updateChildrenCells(parentAddress) {
    let [parentCell, parentCellProp] = getCellAndCellProp(parentAddress);
    let children = parentCellProp.children;
    for (let i = 0; i < children.length; i++) {
        let childAddress = children[i];
        let [childCell, childCellProp] = getCellAndCellProp(childAddress);
        let childFormula = childCellProp.formula;
        let evaluatedValue = evaluateFormula(childFormula);
        setcellUIAndCellProp(evaluatedValue, childFormula, childAddress);
        updateChildrenCells(childAddress);
    }

}
// Eg. B1=A1+10 then children of A1 is B1 bez B1 is dependent on A1.
// A1 contains 10, we moved to B1 then we moved to formula bar and filled A1+10 in it and address bar contains B1. So childAddress is B1 && we dedcoded the formula and got A1 between ascii value>=65&&<=90 .So A1(parent) cell-properties need to be updated.It has children as one of the property,A1's one of the children is B1.
function addChildToParent(formula) {
    let childAddress = addressBar.value;
    let encodedFormula = formula.split(" ");
    for (let i = 0; i < encodedFormula.length; i++) {
        let asciiValue = encodedFormula[i].charCodeAt(0);
        if (asciiValue >= 65 && asciiValue <= 90) {
            let [cell, parentCellProp] = getCellAndCellProp(encodedFormula[i]);
            parentCellProp.children.push(childAddress);
        }
    }
}
function removeChildFromParent(formula) {
    let childAddress = addressBar.value;
    let encodedFormula = formula.split(" ");
    for (let i = 0; i < encodedFormula.length; i++) {
        let asciiValue = encodedFormula[i].charCodeAt(0);
        if (asciiValue >= 65 && asciiValue <= 90) {
            let [cell, parentCellProp] = getCellAndCellProp(encodedFormula[i]);
            let idx = parentCellProp.children.indexOf(childAddress);
            parentCellProp.children.splice(idx, 1);
        }
    }
}
function evaluateFormula(formula) {
    let encodedFormula = formula.split(" ");
    // Eg: if formula bar contains ( A1 + B1 ) then gets converted to ( 10 + 20 ). 
    for (let i = 0; i < encodedFormula.length; i++) {
        let asciiValue = encodedFormula[i].charCodeAt(0);
        if (asciiValue >= 65 && asciiValue <= 90) {
            let [cell, cellProp] = getCellAndCellProp(encodedFormula[i]);
            encodedFormula[i] = cellProp.value;
        }
    }
    let decodedFormula = encodedFormula.join(" ");
    console.log(decodedFormula)
    return eval(decodedFormula);
}

function setcellUIAndCellProp(evaluatedValue, formula, address) {
    let [cell, cellProp] = getCellAndCellProp(address);
    cell.innerText = evaluatedValue;               //UI update
    cellProp.value = evaluatedValue;                //DB update
    cellProp.formula = formula;
}