const scalarSymbol = Symbol("scalar");

type WYSIWYG = { [scalarSymbol]: string; };
type Image = { [scalarSymbol]: string; };
type Email = { [scalarSymbol]: string; };
type Phone = { [scalarSymbol]: string; };
type File = { [scalarSymbol]: string; };
type Timestamp = { [scalarSymbol]: number; };

const guardSymbol = Symbol("guard");

type Enumable = string | number;

type Guard<Of, Flags extends string = never> = ((val: unknown) => boolean) & Omit<{
  optional: Guard<Of, "optional" | Flags>;
  [guardSymbol]: true;
}, Flags>;

type GuardOrSchema<Of> = Guard<Of> | Of;

type Guards<Flags extends string = never> = {
  string: Guard<string, Flags>;
  number: Guard<number, Flags>;
  _enum: <Of extends Enumable>(...values: Of[]) => Guard<Of, Flags>;
  _relation: <Of>(_of: Of) => Guard<Of, Flags>;
};

function relationOrGuardToGuard<Of>(val: GuardOrSchema<Of>): Guard<Of> {
  if (typeof val === "object" && guardSymbol in val) {
    return val as unknown as Guard<Of>;
  }
  return _relation(val);
}

type ArrayGuard = (<Of>(of: GuardOrSchema<Of>) => Guard<Of, "array">) & Guards<"array">;
type OptionalGuard = (<Of>(of: GuardOrSchema<Of>) => Guard<Of, "optional">) & Guards<"optional">;

const array: ArrayGuard = ((_of) => (val) => Array.isArray(val) && val.every(v => relationOrGuardToGuard(_of)(v))) as ArrayGuard;
const optional: OptionalGuard = ((_of) => (val) => val === undefined || relationOrGuardToGuard(_of)(val)) as OptionalGuard;

function guard<Of>(fn: (val: unknown) => boolean): Guard<Of> {
  const newFn = fn as Guard<Of>;
  newFn.optional = optional(fn);
  newFn.optional[guardSymbol] = true;
  newFn[guardSymbol] = true;

  return newFn;
}

const _enum = <Of extends Enumable>(...values: Of[]) => guard<Of>((val) => values.includes(val as Of));
const _relation = <Of>(_of: Of) => guard<Of>((val) => typeof val === "number");
const string = guard<string>(val => typeof val === "string");
const number = guard<number>(val => typeof val === "number");

array.string = array(string);
array.number = array(number);
array._enum = (...values) => array(_enum(...values));
array._relation = (_of) => array(_relation(_of));

optional.string = optional(string);
optional.number = optional(number);
optional._enum = (...values) => optional(_enum(...values));
optional._relation = (_of) => optional(_relation(_of));


const status = _enum("success", "error");
const wysiwyg = guard<WYSIWYG>(val => typeof val === "string");
const image = guard<Image>(val => typeof val === "string");
const email = guard<Email>(val => typeof val === "string");
const phone = guard<Phone>(val => typeof val === "string");
const file = guard<File>(val => typeof val === "string");
const date = guard<Timestamp>(val => typeof val === "number");


export const Location = () => ({
  name: string,
  coordinates: {
    lat: number,
    lon: number
  }
});

export const Job = () => ({
  email: email.optional,
  name: string,
  description: wysiwyg,
  category: string,
  sex: array._enum("m", "w", "d"),
  employment: array._enum("vollzeit", "teilzeit"),
  locations: array(Location),
  status,
  image,
  ...timestamps
});

export const Application = () => ({
  salutation: _enum("herr", "frau", "divers"),
  title: optional._enum("dr", "prof", "drprof"),
  firstName: string,
  lastName: string,
  email,
  phone,
  comment: string,
  cv: file,
  letter: file,

  status: _enum("open", "contacted", "archived"),
  job: Job,
  ...timestamps
});

const timestamps = {
  createdAt: date,
  updatedAt: date
};


type Flag<Of, Flags> =
  "array" extends Flags ? Parse<Of>[] :
    "optional" extends Flags ? Parse<Of> | undefined :
      Of;

type Parse<T> = T extends () => infer U ? Parse<U> :
  T extends Guard<infer Of, infer Flags>
    ? Flag<Of, Flags>
    : T extends { [scalarSymbol]: infer Scalar; }
      ? T
      : T extends Record<string, any>
        ? { [K in keyof T]: Parse<T[K]> }
        : T;


export type LocationModel = Parse<typeof Location>;
export type JobModel = Parse<typeof Job>;
export type ApplicationModel = Parse<typeof Application>;
