

let noise;

function MarchingCubes(cube, xSize, ySize, zSize) {
    let field = [];
    let res = 1.0;
    //let box = [116,346,160,368,6,112];
    let box = [0,xSize-1,0,ySize-1,0,zSize-1];

    function linInd(i,j,k) {return k*xSize*ySize + j*xSize + i;}
    function cubeValue(cube,i,j,k) {let val = cube[linInd(i,j,k)]; return val ? 1 : 0;}

    let vertices = [];
    for (let i = box[0]; i < box[1]; i++) {
        let x = i * res;
        for (let j = box[2]; j < box[3]; j++) {
            let y = j * res;
            for (let k = box[4]; k < box[5]; k++) {
                let z = k * res;
                /*
                let values = [
                    cube[linInd(i,j,k)] + 1,
                    cube[linInd(i + 1,j,k)] + 1,
                    cube[linInd(i + 1,j,k + 1)] + 1,
                    cube[linInd(i,j,k + 1)] + 1,
                    cube[linInd(i,j + 1,k)] + 1,
                    cube[linInd(i + 1,j + 1,k)] + 1,
                    cube[linInd(i + 1,j + 1,k + 1)] + 1,
                    cube[linInd(i,j + 1,k + 1)] + 1,
                ];
                */
                let edges = [
                /*
                    new THREE.Vector3(
                        lerp(x, x + res, (1 - values[0]) / (values[1] - values[0])),
                        y,
                        z
                    ),
                    new THREE.Vector3(
                        x + res,
                        y,
                        lerp(z, z + res, (1 - values[1]) / (values[2] - values[1]))
                    ),
                    new THREE.Vector3(
                        lerp(x, x + res, (1 - values[3]) / (values[2] - values[3])),
                        y,
                        z + res
                    ),
                    new THREE.Vector3(
                        x,
                        y,
                        lerp(z, z + res, (1 - values[0]) / (values[3] - values[0]))
                    ),
                    new THREE.Vector3(
                        lerp(x, x + res, (1 - values[4]) / (values[5] - values[4])),
                        y + res,
                        z
                    ),
                    new THREE.Vector3(
                        x + res,
                        y + res,
                        lerp(z, z + res, (1 - values[5]) / (values[6] - values[5]))
                    ),
                    new THREE.Vector3(
                        lerp(x, x + res, (1 - values[7]) / (values[6] - values[7])),
                        y + res,
                        z + res
                    ),
                    new THREE.Vector3(
                        x,
                        y + res,
                        lerp(z, z + res, (1 - values[4]) / (values[7] - values[4]))
                    ),
                    new THREE.Vector3(
                        x,
                        lerp(y, y + res, (1 - values[0]) / (values[4] - values[0])),
                        z
                    ),
                    new THREE.Vector3(
                        x + res,
                        lerp(y, y + res, (1 - values[1]) / (values[5] - values[1])),
                        z
                    ),
                    new THREE.Vector3(
                        x + res,
                        lerp(y, y + res, (1 - values[2]) / (values[6] - values[2])),
                        z + res
                    ),
                    new THREE.Vector3(
                        x,
                        lerp(y, y + res, (1 - values[3]) / (values[7] - values[3])),
                        z + res
                    ),
                    */
                    // Comment out the upper ones, and uncomment these commented ones
                    // to disable interpolation

                    new THREE.Vector3(x + res / 2, y, z),
                    new THREE.Vector3(x + res, y, z + res / 2),
                    new THREE.Vector3(x + res / 2, y, z + res),
                    new THREE.Vector3(x, y, z + res / 2),
                    new THREE.Vector3(x + res / 2, y + res, z),
                    new THREE.Vector3(x + res, y + res, z + res / 2),
                    new THREE.Vector3(x + res / 2, y + res, z + res),
                    new THREE.Vector3(x, y + res, z + res / 2),
                    new THREE.Vector3(x, y + res / 2, z),
                    new THREE.Vector3(x + res, y + res / 2, z),
                    new THREE.Vector3(x + res, y + res / 2, z + res),
                    new THREE.Vector3(x, y + res / 2, z + res),
                ];

                let state = getState(
                    cubeValue(cube,i,j,k),
                    cubeValue(cube,i + 1,j,k),
                    cubeValue(cube,i + 1,j,k + 1),
                    cubeValue(cube,i,j,k + 1),
                    cubeValue(cube,i,j + 1,k),
                    cubeValue(cube,i + 1,j + 1,k),
                    cubeValue(cube,i + 1,j + 1,k + 1),
                    cubeValue(cube,i,j + 1,k + 1)
                );

                
                //console.log('state=',state);
                for (let edgeIndex of triangulationTable[state]) 
                    if (edgeIndex !== -1) 
                        vertices.push(edges[edgeIndex].x, edges[edgeIndex].y, edges[edgeIndex].z);
            }
        }
    }
    return vertices;
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function getState(a, b, c, d, e, f, g, h) {
    return a * 1 + b * 2 + c * 4 + d * 8 + e * 16 + f * 32 + g * 64 + h * 128;
}

