export class User {
    public uid?: string;
    constructor(
        public name: string, 
        public avatarUrl?: string,
        public id?: number,
        public registrationDate?: Date,
        public lastSeenDate?: Date
        ) {
    }
}