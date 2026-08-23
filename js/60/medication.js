'use strict'

const trackDosage = function (medicationName, initialDosage)
{
    let dosage = initialDosage;
    const medication = {
        getInstructions: function () {
            console.log(`Take ${dosage} of ${medicationName}`)
        },
        adjustDosage: function (doctorPin, newDosage) {
            if (doctorPin === 1234) {
                dosage = newDosage;
            } else {
                throw new Error("You are not the doctor, police is on the way");
            }
        }
    }
    return medication;
}

const AspPresc = trackDosage('Aspirin', '50mg');
AspPresc.getInstructions();
AspPresc.adjustDosage(1234, '200mg');
AspPresc.getInstructions();
AspPresc.adjustDosage(111, '200mg');

