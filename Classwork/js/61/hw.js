// (function () {
  'use strict';

  function trackDosage(medication, dosage) {
    //let medication = medicationName;
    //let dosage = initialDosage;

    const DOCTOR_PIN = 123;

    function foo() {
      console.log('foo');
    }

    return {
      getInstructions() {
        return `take ${dosage}mg of ${medication}`;
      },
      adjustDosage(doctorPin, newDosage) {
        if(doctorPin === DOCTOR_PIN && newDosage > 0) {
          dosage = newDosage;
        }
        else {
          throw new Error('Invalid Dr Pin or dosage');
        }
      },
      foo
    };
  }

  const dosage1 = trackDosage('tylenol', 1);
  console.log(dosage1.getInstructions());

  dosage1.adjustDosage(123, 1.5);
  console.log(dosage1.getInstructions());

  // dosage1.adjustDosage(1, 2);
  // dosage1.adjustDosage(123, 0);

  dosage1.medication = 'foo';
  dosage1.dosage = 6;
  console.log(dosage1.getInstructions());
//})();
