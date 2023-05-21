import * as THREE from 'three';
import { FSF } from '../fsf.js';

// неведомая хрень, я пока не разобрался, для чего. Но без неё нормально не рисует
const triangulationTable = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 8, 3, 9, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 2, 10, 0, 2, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 8, 3, 2, 10, 8, 10, 9, 8, -1, -1, -1, -1, -1, -1, -1],
    [3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 11, 2, 8, 11, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 9, 0, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 11, 2, 1, 9, 11, 9, 8, 11, -1, -1, -1, -1, -1, -1, -1],
    [3, 10, 1, 11, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 10, 1, 0, 8, 10, 8, 11, 10, -1, -1, -1, -1, -1, -1, -1],
    [3, 9, 0, 3, 11, 9, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1],
    [9, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 3, 0, 7, 3, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 9, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 1, 9, 4, 7, 1, 7, 3, 1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 4, 7, 3, 0, 4, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1],
    [9, 2, 10, 9, 0, 2, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1],
    [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1, -1, -1, -1],
    [8, 4, 7, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [11, 4, 7, 11, 2, 4, 2, 0, 4, -1, -1, -1, -1, -1, -1, -1],
    [9, 0, 1, 8, 4, 7, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1],
    [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1, -1, -1, -1],
    [3, 10, 1, 3, 11, 10, 7, 8, 4, -1, -1, -1, -1, -1, -1, -1],
    [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4, -1, -1, -1, -1],
    [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3, -1, -1, -1, -1],
    [4, 7, 11, 4, 11, 9, 9, 11, 10, -1, -1, -1, -1, -1, -1, -1],
    [9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 5, 4, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 5, 4, 1, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [8, 5, 4, 8, 3, 5, 3, 1, 5, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 8, 1, 2, 10, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1],
    [5, 2, 10, 5, 4, 2, 4, 0, 2, -1, -1, -1, -1, -1, -1, -1],
    [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1, -1, -1, -1],
    [9, 5, 4, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 11, 2, 0, 8, 11, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1],
    [0, 5, 4, 0, 1, 5, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1],
    [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1, -1, -1, -1],
    [10, 3, 11, 10, 1, 3, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1],
    [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10, -1, -1, -1, -1],
    [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1, -1, -1, -1],
    [5, 4, 8, 5, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1],
    [9, 7, 8, 5, 7, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 3, 0, 9, 5, 3, 5, 7, 3, -1, -1, -1, -1, -1, -1, -1],
    [0, 7, 8, 0, 1, 7, 1, 5, 7, -1, -1, -1, -1, -1, -1, -1],
    [1, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 7, 8, 9, 5, 7, 10, 1, 2, -1, -1, -1, -1, -1, -1, -1],
    [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1, -1, -1, -1],
    [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1, -1, -1, -1],
    [2, 10, 5, 2, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1],
    [7, 9, 5, 7, 8, 9, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1],
    [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1, -1, -1, -1],
    [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7, -1, -1, -1, -1],
    [11, 2, 1, 11, 1, 7, 7, 1, 5, -1, -1, -1, -1, -1, -1, -1],
    [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1, -1, -1, -1],
    [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1],
    [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0, -1],
    [11, 10, 5, 7, 11, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 0, 1, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 8, 3, 1, 9, 8, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1],
    [1, 6, 5, 2, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 6, 5, 1, 2, 6, 3, 0, 8, -1, -1, -1, -1, -1, -1, -1],
    [9, 6, 5, 9, 0, 6, 0, 2, 6, -1, -1, -1, -1, -1, -1, -1],
    [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1, -1, -1, -1],
    [2, 3, 11, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [11, 0, 8, 11, 2, 0, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 9, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1],
    [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1, -1, -1, -1],
    [6, 3, 11, 6, 5, 3, 5, 1, 3, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6, -1, -1, -1, -1],
    [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1, -1, -1, -1],
    [6, 5, 9, 6, 9, 11, 11, 9, 8, -1, -1, -1, -1, -1, -1, -1],
    [5, 10, 6, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 3, 0, 4, 7, 3, 6, 5, 10, -1, -1, -1, -1, -1, -1, -1],
    [1, 9, 0, 5, 10, 6, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1],
    [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1, -1, -1, -1],
    [6, 1, 2, 6, 5, 1, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1, -1, -1, -1],
    [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1, -1, -1, -1],
    [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9, -1],
    [3, 11, 2, 7, 8, 4, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1],
    [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1, -1, -1, -1],
    [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1],
    [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1],
    [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1, -1, -1, -1],
    [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11, -1],
    [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7, -1],
    [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1, -1, -1, -1],
    [10, 4, 9, 6, 4, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 10, 6, 4, 9, 10, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1],
    [10, 0, 1, 10, 6, 0, 6, 4, 0, -1, -1, -1, -1, -1, -1, -1],
    [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1, -1, -1, -1],
    [1, 4, 9, 1, 2, 4, 2, 6, 4, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1, -1, -1, -1],
    [0, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [8, 3, 2, 8, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1],
    [10, 4, 9, 10, 6, 4, 11, 2, 3, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1, -1, -1, -1],
    [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1, -1, -1, -1],
    [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1, -1],
    [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1, -1, -1, -1],
    [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1],
    [3, 11, 6, 3, 6, 0, 0, 6, 4, -1, -1, -1, -1, -1, -1, -1],
    [6, 4, 8, 11, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [7, 10, 6, 7, 8, 10, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1],
    [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10, -1, -1, -1, -1],
    [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0, -1, -1, -1, -1],
    [10, 6, 7, 10, 7, 1, 1, 7, 3, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1, -1, -1, -1],
    [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9, -1],
    [7, 8, 0, 7, 0, 6, 6, 0, 2, -1, -1, -1, -1, -1, -1, -1],
    [7, 3, 2, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7, -1, -1, -1, -1],
    [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7, -1],
    [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1],
    [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1, -1, -1, -1, -1],
    [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6, -1],
    [0, 9, 1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0, -1, -1, -1, -1],
    [7, 11, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 8, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 9, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [8, 1, 9, 8, 3, 1, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1],
    [10, 1, 2, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, 3, 0, 8, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1],
    [2, 9, 0, 2, 10, 9, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1],
    [6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8, -1, -1, -1, -1],
    [7, 2, 3, 6, 2, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [7, 0, 8, 7, 6, 0, 6, 2, 0, -1, -1, -1, -1, -1, -1, -1],
    [2, 7, 6, 2, 3, 7, 0, 1, 9, -1, -1, -1, -1, -1, -1, -1],
    [1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6, -1, -1, -1, -1],
    [10, 7, 6, 10, 1, 7, 1, 3, 7, -1, -1, -1, -1, -1, -1, -1],
    [10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1, -1, -1, -1],
    [0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7, -1, -1, -1, -1],
    [7, 6, 10, 7, 10, 8, 8, 10, 9, -1, -1, -1, -1, -1, -1, -1],
    [6, 8, 4, 11, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 6, 11, 3, 0, 6, 0, 4, 6, -1, -1, -1, -1, -1, -1, -1],
    [8, 6, 11, 8, 4, 6, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1],
    [9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1, -1, -1, -1],
    [6, 8, 4, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6, -1, -1, -1, -1],
    [4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1, -1, -1, -1],
    [10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1],
    [8, 2, 3, 8, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1],
    [0, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1, -1, -1, -1],
    [1, 9, 4, 1, 4, 2, 2, 4, 6, -1, -1, -1, -1, -1, -1, -1],
    [8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1, -1, -1, -1, -1],
    [10, 1, 0, 10, 0, 6, 6, 0, 4, -1, -1, -1, -1, -1, -1, -1],
    [4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1],
    [10, 9, 4, 6, 10, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 9, 5, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, 4, 9, 5, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1],
    [5, 0, 1, 5, 4, 0, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1],
    [11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5, -1, -1, -1, -1],
    [9, 5, 4, 10, 1, 2, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1],
    [6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1, -1, -1, -1],
    [7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2, -1, -1, -1, -1],
    [3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6, -1],
    [7, 2, 3, 7, 6, 2, 5, 4, 9, -1, -1, -1, -1, -1, -1, -1],
    [9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7, -1, -1, -1, -1],
    [3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1, -1, -1, -1],
    [6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1],
    [9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7, -1, -1, -1, -1],
    [1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4, -1],
    [4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1],
    [7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10, -1, -1, -1, -1],
    [6, 9, 5, 6, 11, 9, 11, 8, 9, -1, -1, -1, -1, -1, -1, -1],
    [3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1, -1, -1, -1],
    [0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1, -1, -1, -1],
    [6, 11, 3, 6, 3, 5, 5, 3, 1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1, -1, -1, -1],
    [0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1],
    [11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1],
    [6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3, -1, -1, -1, -1],
    [5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1, -1, -1, -1],
    [9, 5, 6, 9, 6, 0, 0, 6, 2, -1, -1, -1, -1, -1, -1, -1],
    [1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8, -1],
    [1, 5, 6, 2, 1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1],
    [10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0, -1, -1, -1, -1],
    [0, 3, 8, 5, 6, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [10, 5, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [11, 5, 10, 7, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [11, 5, 10, 11, 7, 5, 8, 3, 0, -1, -1, -1, -1, -1, -1, -1],
    [5, 11, 7, 5, 10, 11, 1, 9, 0, -1, -1, -1, -1, -1, -1, -1],
    [10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1, -1, -1, -1],
    [11, 1, 2, 11, 7, 1, 7, 5, 1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11, -1, -1, -1, -1],
    [9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1, -1, -1, -1],
    [7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1],
    [2, 5, 10, 2, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1],
    [8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1, -1, -1, -1],
    [9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1, -1, -1, -1],
    [9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2, -1],
    [1, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 7, 0, 7, 1, 1, 7, 5, -1, -1, -1, -1, -1, -1, -1],
    [9, 0, 3, 9, 3, 5, 5, 3, 7, -1, -1, -1, -1, -1, -1, -1],
    [9, 8, 7, 5, 9, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [5, 8, 4, 5, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1],
    [5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1, -1, -1, -1],
    [0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5, -1, -1, -1, -1],
    [10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4, -1],
    [2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1, -1, -1, -1],
    [0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1],
    [0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5, -1],
    [9, 4, 5, 2, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1, -1, -1, -1],
    [5, 10, 2, 5, 2, 4, 4, 2, 0, -1, -1, -1, -1, -1, -1, -1],
    [3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1],
    [5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1, -1, -1, -1],
    [8, 4, 5, 8, 5, 3, 3, 5, 1, -1, -1, -1, -1, -1, -1, -1],
    [0, 4, 5, 1, 0, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1, -1, -1, -1],
    [9, 4, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 11, 7, 4, 9, 11, 9, 10, 11, -1, -1, -1, -1, -1, -1, -1],
    [0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1, -1, -1, -1],
    [1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1, -1, -1, -1],
    [3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4, -1],
    [4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1, -1, -1, -1],
    [9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1],
    [11, 7, 4, 11, 4, 2, 2, 4, 0, -1, -1, -1, -1, -1, -1, -1],
    [11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4, -1, -1, -1, -1],
    [2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1, -1, -1, -1],
    [9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1],
    [3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10, -1],
    [1, 10, 2, 8, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 9, 1, 4, 1, 7, 7, 1, 3, -1, -1, -1, -1, -1, -1, -1],
    [4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1, -1, -1, -1, -1],
    [4, 0, 3, 7, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 8, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 9, 3, 9, 11, 11, 9, 10, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 10, 0, 10, 8, 8, 10, 11, -1, -1, -1, -1, -1, -1, -1],
    [3, 1, 10, 11, 3, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 2, 11, 1, 11, 9, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9, -1, -1, -1, -1],
    [0, 2, 11, 8, 0, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 3, 8, 2, 8, 10, 10, 8, 9, -1, -1, -1, -1, -1, -1, -1],
    [9, 10, 2, 0, 9, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1, -1, -1, -1],
    [1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 3, 8, 9, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
];

export class Cube {
    // cube {dims:[], data:[]} 	- такие объекты возвращаются FSFparse
    // FSF TTTT - 0: Int8,  1:Uint8,  2:Int16,  3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64; 8:String 0xF:internal use

    /**
     * @param {!FSFProtoCube} protoCube 	Это объект прото-куб
     * @param {string=} name Optional
     *
     * Прото-куб содержит 2 обязательных поля - data и dims. До сих пор кубы бывали типа Uint8Array или Int16Array,
     * хотя data может быть любым TypedArray. Необязательное поле maskType используется для детализации типа data.
     * Если maskType=BITMASK, то data является Uint8Array, в котором воксели хранятся в виде упакованного битового
     * массива, при этом размерность куба определяется dims. Если maskType=MASKWITHROI или BITMASKWITHROI,
     * то в протокубе должен присутствовать
     * элемент ROI (Region Of Interest) - массив из 6 элементов [xmin,xmax,ymin,ymax,zmin,zmax], который определяет
     * подмножество исходного куба, в котором находятся единичные элементы. Например, для Колмыкова ROI составляет 17%
     * от исходного куба. Здесь надо отметить, чем ROI протокуба отличается от вычисляемого ROI самого куба (this.ROI).
     * 1) если задан ROI в протокубе, то this.ROI не вычисляется 2) ROI протокуба отпределяет размерность data
     * То есть если в протокубе нет ROI, то размерность куба определеятся dims, а если есть, то protoCube.ROI. То есть
     * кубы, имеющие ROI в протокубе, занимают меньше места при хранении и быстрее передаются. Еще более экономичным
     * должен быть тип битовая маска с ROI (еще не реализован)
     *
     */
    constructor (protoCube, name) {
        // TBD: проверять корректность входных данных
        this._protoCube = protoCube;
        this.dims = protoCube.dims;
        this.data = protoCube.data;
        this.ROI = [];	// [xmin,xmax,ymin,ymax,zmin,zmax]
        this.nonzero = { first: -1, last: -1, total: 0 };
        this.length = this.dims[0] * this.dims[1] * this.dims[2];
        // assert(this.length == this.data.length);
        this.name = name || '';
        this.roiVertexMin = new THREE.Vector3(0, 0, 0);
        this.roiVertexMax = new THREE.Vector3(0, 0, 0);
        this.parentData = [];		// это эксперименты с интерполяцией по исходному объему
    }

    /**
     * Перевод индексов IJK в линейный
     */
    IJK2lin (i, j, k) { return (i + j * this.dims[0] + k * this.dims[0] * this.dims[1]); }
    lin2IJK (i) {
        const I = i % this.dims[0]; const J = ((i - I) / this.dims[0]) % this.dims[1]; const K = Math.floor(i / this.dims[0] / this.dims[1]);
        return [I, J, K];
    }
    /** @return {THREE.BufferGeometry} число элементов в кубе */
    // length() { return this.dims[0] * this.dims[1] * this.dims[2] }

    geometry () {
        const pref = 'Cube(' + this.name + ')::geometry()';
        // console.log(pref)
        // let vertices = MarchingCubes(this.data,this.dims[0],this.dims[1],this.dims[2]);
        const vertices = (this.data.length == 0 ? [] : this.marchingCubes());
        this.vertStat(vertices);
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        // console.log(pref+'.boundingBox=', geometry.boundingBox)
        // console.log(pref+'.boundingBox.getCenter()', geometry.boundingBox.getCenter())
        return geometry;
    }

    // vertices[] - набор триплетов xyz
    vertStat (vertices) {
        if (vertices.length % 3 !== 0 || vertices.length === 0) {
            console.log('Cube::vertStat(): vertices length not multiple 3 or equal 0');
            return;
        }
        // ll - low left; ur - upper right
        const ll = new THREE.Vector3(vertices[0], vertices[1], vertices[2]); const ur = new THREE.Vector3().copy(ll);
        const numPts = vertices.length / 3;
        for (let i = 0; i < numPts; i++) {
            const x = vertices[3 * i + 0]; const y = vertices[3 * i + 1]; const z = vertices[3 * i + 2];
            if (ll.x > x) ll.x = x; if (ur.x < x) ur.x = x;
            if (ll.y > y) ll.y = y; if (ur.y < y) ur.y = y;
            if (ll.z > z) ll.z = z; if (ur.z < z) ur.z = z;
        }
        // console.log('Cube::vertStat(): min='+toString(ll)+' max='+toString(ur));
    }

    /**
     * Возвращает величину вокселя с индексом IJK (с проверкой за выход из диапазона)
     * В случае битовой маски учитывает упакованный характер массива
     * Также учитывает особый характер данных для кубов с ROI
     * @param {!number} i
     * @param {!number} j
     * @param {!number} k
     * @return {number}
     */
    getValue (i, j, k) {
        if (i < 0 || i >= this.dims[0] || j < 0 || j >= this.dims[1] || k < 0 || k >= this.dims[2]) { throw new Error('FSF: getValue() invalid [' + i + ',' + j + ',' + k + ']'); }

        if (this._protoCube.maskType &&
        (this._protoCube.maskType == FSF.CONST.MASKWITHROI || this._protoCube.maskType == FSF.CONST.BITMASKWITHROI)) {
            // вне куба ROI все значения нули
            if (i < this._protoCube.ROI[0] || i > this._protoCube.ROI[1]	||
            j < this._protoCube.ROI[2] || j > this._protoCube.ROI[3]	||
            k < this._protoCube.ROI[4] || k > this._protoCube.ROI[5]) { return 0; }

            // посчитаем линейный индекс по ROI
            const dimsROI = [this._protoCube.ROI[1] - this._protoCube.ROI[0] + 1,
                this._protoCube.ROI[3] - this._protoCube.ROI[2] + 1,
                this._protoCube.ROI[5] - this._protoCube.ROI[4] + 1];
            const ijkROI = [i - this._protoCube.ROI[0], j - this._protoCube.ROI[2], k - this._protoCube.ROI[4]];
            const linIndROI = (ijkROI[0] + ijkROI[1] * dimsROI[0] + ijkROI[2] * dimsROI[0] * dimsROI[1]);

            if (this._protoCube.maskType == FSF.CONST.MASKWITHROI) { return this.data[linIndROI]; } else { // FSF.CONST.BITMASKWITHROI
                const off = linIndROI % 8; const packedLinInd = (linIndROI - off) / 8;
                return (this.data[packedLinInd] & (1 << 7 - off)) ? 1 : 0;
            }
        }

        // если имеем дело с воксельной битовой маской
        // data является массивом Uint8Array вокселей, упакованных побитно
        if (this._protoCube.maskType == FSF.CONST.BITMASK) {
            const linInd = this.IJK2lin(i, j, k);
            const off = linInd % 8; const ind = (linInd - off) / 8;
            const val = this.data[ind] & (1 << 7 - off);
            return val ? 1 : 0;
        }

        // это обычный куб
        const val = this.data[this.IJK2lin(i, j, k)];
        return val ? 1 : 0;
    }

    // это специальный метод доступа к BITMASKWITHROI по линейному индексу и лишних проверок
    getValueROI (i) {
        const off = i % 8; const packedLinInd = (i - off) / 8;
        return (this.data[packedLinInd] & (1 << 7 - off)) ? 1 : 0;
    }

    // author KineticTactic: https://github.com/KineticTactic/marching-cubes-js с моими (уже сильными) модификациями
    // marchingCubes сейчас работает исключительно с битовыми кубами с ROI (BITMASKWITHROI), так как использует
    // getValueROI для доступа к данным. Чтобы восстановить работу с другими типами кубов, надо использовать
    // getValue(ijk), но это более медленный способ работы
    //
    marchingCubes () {
        const t0 = performance.now();
        // пока интерполяцию лучше не влючать. это эксперименты
        let interpolate = false;
        if (!this.parentData.length) interpolate = false;
        // console.log('Cube::marchingCubes(interpolate='+interpolate+')')
        const res = 1.0; const halfRes = res / 2; let box;
        if (this._protoCube.maskType &&
        (this._protoCube.maskType == FSF.CONST.MASKWITHROI || this._protoCube.maskType == FSF.CONST.BITMASKWITHROI)) { box = this._protoCube.ROI; } else {
            if (this.ROI.length == 0) this.nonzerostats();
            box = this.ROI;
            // box = [this.ROI[0],this.ROI[1],this.ROI[2],this.ROI[3],this.ROI[4],this.ROI[5]];
        }
        // box = [0,this.dims[0]-1,0,this.dims[1]-1,0,this.dims[2]-1];

        let ct = 0; let cf = 0;	// ct - свой/чужой true cf - false
        let derv = 0;	// max отклонение mu от 0.5
        function lerp (start, end, v0, v1) {
            const isolevel = [150, 590];
            const f0 = (v0 >= isolevel[0] && v0 <= isolevel[1]);
            const f1 = (v1 >= isolevel[0] && v1 <= isolevel[1]);
            // f0 и f1 должны быть взаимо исключены - свой/чужой
            const ff = (f0 && !f1) || (!f0 && f1);
            if (ff) ct++; else cf++;
            // if(ff && cnt < 10) {
            // 	console.log("не нарушен свой/чужой",start, end, v0, v1)
            // 	cnt++;
            // }
            if (ff) {
                let mu, res;
                if (!f0) {	// чужой v0
                    if (v0 < isolevel[0])	{ mu = (isolevel[0] - v0) / (v1 - v0); }
                    if (v0 > isolevel[1])	{ mu = (v0 - isolevel[1]) / (v0 - v1); }
                } else {		// чужлй v1
                    if (v1 < isolevel[0])	{ mu = (isolevel[0] - v1) / (v0 - v1); }
                    if (v1 > isolevel[1])	{ mu = (v1 - isolevel[1]) / (v1 - v0); }
                }
                if ((mu < 0.0 || mu > 1.0) && cnt == 0) {
                    cnt++;
                    console.log('странное mu ', start, end, v0, v1, mu, res);
                }
                if (Math.abs(mu - 0.5) > derv) derv = Math.abs(mu - 0.5);
                return start + mu * (end - start);
            }

            return (start + end) / 2;		// простая интерполяция

            // return (1 - amt) * start + amt * end;
        }
        function getState (a, b, c, d, e, f, g, h) { return a * 1 + b * 2 + c * 4 + d * 8 + e * 16 + f * 32 + g * 64 + h * 128; }

        const roiDims = [box[1] - box[0] + 1, box[3] - box[2] + 1, box[5] - box[4] + 1]; const w = roiDims[0]; const h = roiDims[1]; const wh = w * h;
        const vertices = [];

        for (let k = box[4]; k < box[5]; k++) {
            const z = k * res;
            for (let j = box[2]; j < box[3]; j++) {
                const y = j * res;
                for (let i = box[0]; i < box[1]; i++) {
                    const x = i * res;

                    if (interpolate) {
                        /*
                                                let values = [
                                                    this.parentData[linInd(i,j,k)],
                                                    this.parentData[linInd(i + 1,j,k)],
                                                    this.parentData[linInd(i + 1,j,k + 1)],
                                                    this.parentData[linInd(i,j,k + 1)],
                                                    this.parentData[linInd(i,j + 1,k)],
                                                    this.parentData[linInd(i + 1,j + 1,k)],
                                                    this.parentData[linInd(i + 1,j + 1,k + 1)],
                                                    this.parentData[linInd(i,j + 1,k + 1)],
                                                ];

                                                edges = [
                                                    new THREE.Vector3(lerp(x, x + res, values[0],  values[1]), y, z ),
                                                    new THREE.Vector3(x + res, y, lerp(z, z + res, values[1], values[2])),
                                                    new THREE.Vector3(lerp(x, x + res, values[2],  values[3]), y, z + res),
                                                    new THREE.Vector3(x, y, lerp(z, z + res, values[0] , values[3])),
                                                    new THREE.Vector3(lerp(x, x + res, values[4] , values[5]), y + res, z),
                                                    new THREE.Vector3(x + res, y + res, lerp(z, z + res, values[5] , values[6])),
                                                    new THREE.Vector3(lerp(x, x + res, values[7] , values[6]), y + res, z + res),
                                                    new THREE.Vector3(x, y + res, lerp(z, z + res, values[4] , values[7])),
                                                    new THREE.Vector3(x, lerp(y, y + res, values[0] , values[4]), z),
                                                    new THREE.Vector3(x + res, lerp(y, y + res, values[1] , values[5]), z),
                                                    new THREE.Vector3(x + res, lerp(y, y + res, values[2] , values[6]), z + res),
                                                    new THREE.Vector3(x, lerp(y, y + res, values[3] , values[7]), z + res),
                                                ];
                        */
                    }

                    const ijkLinInd = (i - box[0]) + (j - box[2]) * w + (k - box[4]) * wh;
                    const state = getState(
                        this.getValueROI(ijkLinInd), // this.getValue(i,j,k),
                        this.getValueROI(ijkLinInd + 1), // this.getValue(i + 1,j,k),
                        this.getValueROI(ijkLinInd + 1 + wh), // this.getValue(i + 1,j,k + 1),
                        this.getValueROI(ijkLinInd + wh), // this.getValue(i,j,k + 1),
                        this.getValueROI(ijkLinInd + w), // this.getValue(i,j + 1,k),
                        this.getValueROI(ijkLinInd + 1 + w), // this.getValue(i + 1,j + 1,k),
                        this.getValueROI(ijkLinInd + 1 + w + wh), // this.getValue(i + 1,j + 1,k + 1),
                        this.getValueROI(ijkLinInd + w + wh) // this.getValue(i,j + 1,k + 1)
                    );

                    const edge = triangulationTable[state];
                    for (let e = 0; e < edge.length; e++) {
                        const edgeIndex = edge[e];
                        if (edgeIndex !== -1) {
                            switch (edgeIndex) {
                                case 0: vertices.push(x + halfRes, y, z); break;
                                case 1: vertices.push(x + res, y, z + halfRes); break;
                                case 2: vertices.push(x + halfRes, y, z + res); break;
                                case 3: vertices.push(x, y, z + halfRes); break;
                                case 4: vertices.push(x + halfRes, y + res, z); break;
                                case 5: vertices.push(x + res, y + res, z + halfRes); break;
                                case 6: vertices.push(x + halfRes, y + res, z + res); break;
                                case 7: vertices.push(x, y + res, z + halfRes); break;
                                case 8: vertices.push(x, y + halfRes, z); break;
                                case 9: vertices.push(x + res, y + halfRes, z); break;
                                case 10: vertices.push(x + res, y + halfRes, z + res); break;
                                case 11: vertices.push(x, y + halfRes, z + res); break;
                            } 
                        }
                    }
                }
            }
        }
        // console.log('Cube::marchingCubes takes',((performance.now() - t0)/1000).toFixed(3),' сек')
        // console.log('vertices=',vertices)
        return vertices;
    }

    // вычисляет this.nonzero и this.ROI (для обычных кубов)
    nonzerostats (printstats) {
        // console.log(`nonzerostats(${printstats})`)
        // console.log("Cube::nonzerostats() length=",this.length)
        this.nonzero = { total: 0, first: -1, last: -1 };

        // учитываем пустые кубы (zero-ROI)
        if (this.data.length == 0) return;

        // для протокуба с ROI вычисляем только non-zero-stats
        if (this._protoCube.maskType &&
        (this._protoCube.maskType == FSF.CONST.MASKWITHROI || this._protoCube.maskType == FSF.CONST.BITMASKWITHROI)) {
            let il, jl, kl;
            for (let k = this._protoCube.ROI[4]; k <= this._protoCube.ROI[5]; k++) {
                for (let j = this._protoCube.ROI[2]; j <= this._protoCube.ROI[3]; j++) {
                    for (let i = this._protoCube.ROI[0]; i <= this._protoCube.ROI[1]; i++) {
                        const val = this.getValue(i, j, k);
                        if (val) {
                            this.nonzero.total++;
                            if (this.nonzero.first == -1) { this.nonzero.first = this.IJK2lin(i, j, k); }
                            il = i; jl = j; kl = k;
                        }
                    } 
                } 
            }
            this.nonzero.last = this.IJK2lin(il, jl, kl);
            // return;
        } else {
            // для обычного куба вычисляем ROI и non-zero-stats
            this.ROI = [this.dims[0], -1, this.dims[1], -1, this.dims[2], -1];
            for (let i = 0; i < this.length; i++) {
                const ijk = this.lin2IJK(i);
                const val = this.getValue(ijk[0], ijk[1], ijk[2]);
                if (val) {
                    this.nonzero.total++;
                    if (this.nonzero.first == -1) this.nonzero.first = i;
                    this.nonzero.last = i;
                    // такое странное преобразование '| 0' гарантирует, что результат будет int, а не float
                    if (this.ROI[0] > ijk[0]) this.ROI[0] = ijk[0] | 0;
                    if (this.ROI[1] < ijk[0]) this.ROI[1] = ijk[0] | 0;
                    if (this.ROI[2] > ijk[1]) this.ROI[2] = ijk[1] | 0;
                    if (this.ROI[3] < ijk[1]) this.ROI[3] = ijk[1] | 0;
                    if (this.ROI[4] > ijk[2]) this.ROI[4] = ijk[2] | 0;
                    if (this.ROI[5] < ijk[2]) this.ROI[5] = ijk[2] | 0;
                }
            }
        }
        if (printstats != undefined) {
            this.roiVertexMin.copy(new THREE.Vector3(this.ROI[0], this.ROI[2], this.ROI[4]));
            this.roiVertexMax.copy(new THREE.Vector3(this.ROI[1], this.ROI[3], this.ROI[5]));
            this.log();
        }
    }

    toString () { return 'cube ' + this.name + '[' + this.dims[0] + ',' + this.dims[1] + ',' + this.dims[2] + ']'; }
    log () {
        let str = 'cube ' + this.name + '[' + this.dims[0] + ',' + this.dims[1] + ',' + this.dims[2] + ']' + ' nonzero-stats:';
        str += '{first:' + this.nonzero.first + ',last:' + this.nonzero.last + ',total:' + this.nonzero.total + '}';
        if (this._protoCube.maskType &&
        (this._protoCube.maskType == FSF.CONST.MASKWITHROI || this._protoCube.maskType == FSF.CONST.BITMASKWITHROI)) { str += ' protoCube.ROI=[' + this._protoCube.ROI[0] + 'x' + this._protoCube.ROI[1] + ',' + this._protoCube.ROI[2] + 'x' + this._protoCube.ROI[3] + ',' + this._protoCube.ROI[4] + 'x' + this._protoCube.ROI[5] + ']'; } else { str += ' ROI=[' + this.ROI[0] + 'x' + this.ROI[1] + ',' + this.ROI[2] + 'x' + this.ROI[3] + ',' + this.ROI[4] + 'x' + this.ROI[5] + ']'; }
        // str += ' ROImin='+toString(this.roiVertexMin)+' ROImax='+toString(this.roiVertexMax);
        console.log(str);
    }

    roiBox () {
        return new THREE.BoxBufferGeometry(this.ROI[1] - this.ROI[0], this.ROI[3] - this.ROI[2], this.ROI[5] - this.ROI[4]);
    }

    // пробегает по маске аорты и подсчитывает статистику по parentData - min/max/agv
    parentStats () {
        console.log('Cube::parentStats()');
        if (!this.parentData) return;
        // здесь предполагается что размерность кубы и родителя совпадают
        const st = { min: Infinity, max: -Infinity, avg: 0 }; let n = 0;
        for (let i = 0; i < this.parentData.length; i++) {
            if (this.data[i]) {
                const v = this.parentData[i];
                if (st.min > v) st.min = v;
                if (st.max < v) st.max = v;
                st.avg += v;
                n++;
            }
        }
        st.avg /= n;
        console.log('stat', st, 'n', n, 'parentData.length', this.parentData.length);
    }

    /**
     *  Этот метод вычисляет среднюю интерсивность куба, а также минимальное и макстмальное значение интенсивности
     *  Применяется для упрошенного ручного контроля правильности переданного на сервер куба
     */
    averageIntensity () {
        let cMin = Number.MAX_SAFE_INTEGER; let cMax = -Number.MAX_SAFE_INTEGER; const length = this.length; let sum = 0;
        for (let i = 0; i < length; i++) {
            const d = this.data[i];
            if (d < cMin) cMin = d;
            if (d > cMax) cMax = d;
            sum += d;
        }
        console.log('Cube::averageIntencity() length' + length + 'min/max  ' + cMin + '/' + cMax + ' avg ' + sum / length);
    }

    /**
     * Этот метод превращает куб в BITMASKWITHROI
     */
    compress () {
        if (this._protoCube.maskType && this._protoCube.maskType == FSF.CONST.BITMASKWITHROI) return;
        this.nonzerostats();
        const box = this.ROI;
        const bytesInROI = (box[1] - box[0] + 1) * (box[3] - box[2] + 1) * (box[5] - box[4] + 1);
        const bytesInMask = Math.floor(bytesInROI / 8);
        const bitmask = new Uint8Array(bytesInMask);
        let linInd = 0; let offset = 0; bitmask[0] = 0;
        for (let k = box[4]; k <= box[5]; k++) {
            for (let j = box[2]; j <= box[3]; j++) {
                for (let i = box[0]; i <= box[1]; i++) {
                    const val = this.getValue(i, j, k) ? 1 : 0;
                    bitmask[linInd] |= val << (7 - offset);
                    offset++;
                    if (offset == 8) {
                        linInd++;
                        bitmask[linInd] = 0;
                        offset = 0;
                    }
                } 
            } 
        }
        // преобразовываем куб в BITMASKWITHROI
        this.ROI = [];
        this._protoCube.maskType = FSF.CONST.BITMASKWITHROI;
        this._protoCube.ROI = box;
        this.data = bitmask;
        this._protoCube.data = null;
    }

    //= ================================================================
    //
    //= ================================================================

    atFace0 (i) { return i < this.dims[0] * this.dims[1]; }												// нижняя стенка
    atFace1 (i) { return ((i - i % this.dims[0]) / this.dims[0]) % this.dims[1] == 0; }					// задняя стенка
    atFace2 (i) { return (i % this.dims[0]) == 0; }														// левая стенка
    atFace3 (i) { return ((i - i % this.dims[0]) / this.dims[0]) == this.dims[0] - 1; }					// правая стенка
    atFace4 (i) { return ((i - i % this.dims[0]) / this.dims[0]) % this.dims[1] == this.dims[1] - 1; }	// передняя стенка
    atFace5 (i) { return i >= this.dims[0] * this.dims[1] * (this.dims[2] - 1); }								// верхняя стенка

    /**
     * @param {!Number} 	линейный индекс вокселя по кубу
     * @return {Set} 		поддутая на 1 шаг поверхность в метрике N6 от данного вокселя с учетом стенок
     * 						воксели в множестве хранятся как линейные индексы.
     * 						В JS Number.MAX_SAFE_INTEGER равен (2^53 - 1), то есть примерно 2^18 на индекс IJK
     * 						На нашу жизнь хватит.
     */
    inflateVertexN6 (i) {
        const k = this.dims[0]; const l = this.dims[1]; const m = this.dims[2];
        const sv = new Set();
        if (!this.atFace0(i)) sv.add(i - k * l);
        if (!this.atFace1(i)) sv.add(i - k);
        if (!this.atFace2(i)) sv.add(i - 1);
        if (!this.atFace3(i)) sv.add(i + 1);
        if (!this.atFace4(i)) sv.add(i + k);
        if (!this.atFace5(i)) sv.add(i + k * l);
        return sv;
    }

    inflateSetN6 (sv) {
        let svv = new Set();
        for (const v of sv) { svv = new Set([...svv, ...this.inflateVertexN6(v)]); }
        return new Set([...svv, ...sv]);
    }

    /*
     * @param {!Number} center - это линейный индекс вокселя - центра сферы
     * @param {!Number} radius - количество "наддутий" центра по метрике N6
     * получается, что это максимальное отдаление в вокселях края сферы от центра, то есть радиус
     * @return {Set} воксели сферы
     */
    inflateSphereN6 (center, radius) {
        const sv0 = this.inflateVertexN6(center);
        const sv1 = this.inflateSetN6(sv0);
        const sv2 = this.inflateSetN6(sv1);
        return sv2;
    }
}
