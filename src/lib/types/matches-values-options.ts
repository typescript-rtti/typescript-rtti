
export interface MatchesValueOptions {
    /**
     * An array where errors encountered while validating an object are saved.
     * If you don't supply this, you won't be able to get the list of errors.
     */
    errors?: Error[];

    context?: string;

    /**
     * Whether to allow extra properties that do not conform to the type.
     * Though Typescript normally allows extra properties, it is a potential
     * security vulnerability if the user chooses to use this to validate
     * user-controlled objects, so you have to opt in if you expect extra
     * properties to be present.
     *
     * @default false
     */
    allowExtraProperties?: boolean;
}
