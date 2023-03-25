import { type SeriesModel } from 'ami.js';

class Patient {
    readonly name: string;
    readonly sex: PatientSex;
    readonly age: string;
    readonly id: string;
    readonly birthdate: string;
    
    constructor(seriesModel: SeriesModel) {
        this.sex = Patient.getPatientSex(seriesModel.patientSex);
        this.name = seriesModel.patientName;
        this.age = seriesModel.patientAge;
        this.birthdate = seriesModel.patientBirthdate;
        this.id = seriesModel.patientID;
    }

    static getPatientSex(patientSexId: string): PatientSex {
        switch (patientSexId) {
            case 'F':
                return PatientSex.FEMALE;
            case 'M':
                return PatientSex.MALE;
            default:
                return PatientSex.UNKNOWN;
        }
    }
}

enum PatientSex {
    FEMALE,
    MALE,
    UNKNOWN
}

export { Patient, PatientSex };
