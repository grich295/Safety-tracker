SAFETY TRACKER v2.11.58 - HOD + VISIBLE INSTRUCTOR PERMISSION

Upload ALL files in this ZIP to the Safety Tracker repository root.

DATABASE:
Already updated. Do not run SQL manually.

PEOPLE & ACCESS:
Each Safety user now has a clearly visible PROFILE PERMISSIONS button.
That screen contains:
  [ ] Head of Department (HOD)
  [ ] Can carry out instructor-led training

HOD:
- exactly ONE active HOD per department
- enforced in the database
- HOD department comes automatically from the person's Main/Default position
- selecting HOD automatically makes that person the Department Manager /
  responsible owner for the department
- selecting a new HOD warns that it will replace the current HOD
- Department Managers / HODs automatic Group follows this profile selection

SUPERVISORS:
- there can be MULTIPLE Supervisors in a department
- Supervisor is a normal job title / position, not a unique responsibility
- any suitable Supervisor can have CAN CARRY OUT INSTRUCTOR-LED TRAINING ticked
- this does not make the Supervisor HOD or responsible for all department training

INSTRUCTOR-LED TRAINING:
- HOD remains the default responsible owner
- Admin / Manager can always deliver
- authorised Supervisor / trainer can deliver for their own Department(s)
- actual trainer is whoever records attendance

The older hidden training-permission decorator is removed; v2.11.58 is the
single visible profile-permission control.
