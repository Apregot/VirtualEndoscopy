/* Здесь будут собраны тесты, связанные с преобразованиями систем координат, а также с изучением AMI.UtilsCore и других вспомогательных классов.
 * Конечная цель этих экспериментов - понять, что же все-таки изображено ортографической камерой в R6 на срезе куба плоскостью,
 * перпендикулярной центральной линии сосуда. А также надо научиться рисовать в R6 контур среза сосуда. Координаты самих точек
 * среза в мировых координатах уже получены, но непонятно, как их спроецировать на экран R6. Предположительно, если 
 * core.utils.js выглядит "в миру", то есть после преобразования webpack'ом как AMI.UtilsCore, то core.intersections.js 
 * будет вызываться как AMI.IntersectionsCore. Подробнее про системы координат LPS, RAS и пр. можно посмотреть по этой ссылке
 * https://docs.google.com/document/d/1A9mgIZ3qy570ugnBK95kF4wGTaukS4irdwuftji_jps
 * но это нерасшаренная ссылка и доступна только с моего гугл-аккаунта. Довольно подробно это описано еще здесь:
 * https://www.slicer.org/wiki/Coordinate_systems и здесь https://theaisummer.com/medical-image-coordinates/
 * Серия экспериментов такая: (AABB это в терминологии AMI  Axe Aligned Bounding Box)
 * aabb_test_1: кубик 20х20х20 в центре координат режется плоскостью XY и выводятся координаты точек пересения
 * aabb_test_1: кубик режется плоскостью XY с нормалью в сторону вектора (1,1,1)
 * 
*/
 
function AABB_tests() {
  aabb_test_2();
}

function aabb_test_1() {         
  let aabb = stand_cube(), plane = { position: v(0,0,0), direction: v(0,0,1), };
  let intersections = AMI.IntersectionsCore.aabbPlane(aabb, plane); console.log('intersections',intersections)
}
function aabb_test_2() {         
  let aabb = stand_cube(), plane = { position: v(0,0,0), direction: v(1,1,1).normalize(), };
  let intersections = AMI.IntersectionsCore.aabbPlane(aabb, plane); console.log('intersections',intersections)
}

function v(x,y,z) { return new THREE.Vector3(x,y,z)}
function stand_cube() {return { halfDimensions: v(10,10,10), center: v(0,0,0), toAABB: new THREE.Matrix4(), }}
