
type TableRecord = { [key: string]: unknown };

type DataFrame<T extends TableRecord> = {
  [P in keyof T]: T[P][];
};

type WithSymbolValues<T> = {
  [K in keyof T]: T[K] | symbol;
};

/**
 * Represents a data table with indexable fields.
 *
 * `Microtable` is a data structure for representing a table of records,
 * where each record is an object with named fields. The table supports
 * efficient querying on these records based on field values, and can create
 * indexes on specific fields to optimize these queries.
 *
 * @example
 *
 * ```typescript
 * type Activity = {person: string, activity: string, rating: number};
 * const activities = Microtable.create<Activity>([
 *   {person: 'Alice',   activity: 'hiking',   rating: 5},
 *   {person: 'Alice',   activity: 'swimming', rating: 3},
 *   {person: 'Bob',     activity: 'hiking',   rating: 2},
 *   {person: 'Bob',     activity: 'swimming', rating: 4},
 *   {person: 'Bob',     activity: 'running',  rating: 5},
 *   {person: 'Charlie', activity: 'swimming', rating: 5},
 *   {person: 'Charlie', activity: 'running',  rating: 1},
 * ]);
 * table.insert({person: 'Charlie', activity: 'hiking', rating: 4});
 * table.createIndex(['person', 'activity']);
 * console.log(table.where({person: 'Alice', activity: 'hiking'}).records());
 * ```
 */
export class Microtable<T extends TableRecord> {
  private data: DataFrame<T>;
  private indexes: { [key: string]: Map<any, number[]> };
  private uniquenessIndexNames: string[] = [];
  private fields: (keyof T)[];
  public length: number;
  static blank = Symbol('blank');

  constructor(data: DataFrame<T> | T[], fields: (keyof T)[] = []) {
    if (Array.isArray(data)) {
      const keys = fields.length ? fields : Object.keys(data[0]) as (keyof T)[];
      this.data = keys.reduce((acc, key) => {
        acc[key] = [];
        return acc;
      }, {} as DataFrame<T>);
      data.forEach((row) => {
        keys.forEach((key) => {
          this.data[key].push(row[key]);
        });
      });
      this.fields = keys;
      this.length = data.length;
    } else {
      this.data = data;
      this.fields = Object.keys(data) as (keyof T)[];
      this.length = data[Object.keys(data)[0]].length;
    }
    this.indexes = {};
  }
  /**
   * Creates a new Microtable instance.
   *
   * The Microtable is a data structure that allows efficient querying on
   * rows of data. Each row is an object with named fields, and queries are
   * expressed as objects with matching field names.
   *
   * Indexes can be created on one or more fields to optimize the performance
   * of certain queries.
   *
   * @param {DataFrame<T> | T[]} data - The data to initialize the table with.
   * @param {string[]} [fields] - The names of the fields in the data (optional).
   *
   * @example
   * const alphabet = Microtable.create<{ index: number; letter: string }>({
   *    index: [1, 2, 3],
   *    letter: ['a', 'b', 'c'],
   * });
   *
   * const alphabet = Microtable.create<{ index: number; letter: string }>([
   *   { index: 1, letter: 'a' },
   *   { index: 2, letter: 'b' },
   *   { index: 3, letter: 'c' },
   * ]);
   */
  static create<T extends TableRecord>(data: DataFrame<T> | T[], fields: (keyof T)[] = []) {
    return new Microtable<T>(data, fields);
  }

  /**
   * Returns all records in the table.
   *
   * @returns {T[]} An array of objects representing the records in the table.
   *
   * @example
   * ```
   * const alphabet = Microtable.create<{ index: number; letter: string }>({
   *   index: [1, 2, 3],
   *   letter: ['a', 'b', 'c'],
   * });
   * console.log(alphabet.records());
   * // Output: [{ index: 1, letter: 'a' }, { index: 2, letter: 'b' }, { index: 3, letter: 'c' }]
   * ```
   **/
  records(): T[] {
    return Array.from({ length: this.length }, (_, i) => this.record(i));
  }

  /**
   * Returns the record at the specified index.
   * 
   * @param {number} i - The index of the record to return.
   * @returns {T} The record at the specified index.
   * 
   * @example
   * const alphabet = Microtable.create<{ index: number; letter: string }>({
   *   index: [1, 2, 3],
   *   letter: ['a', 'b', 'c'],
   * });
   * console.log(alphabet.record(1));
   * // Output: { index: 2, letter: 'b' }
   */
  private record(i: number): T {
    const record: Partial<T> = {};
    Object.keys(this.data).forEach((key) => {
      (record as any)[key] = this.data[key][i];
    });
    return record as T;
  }

  /**
   * Returns a string representation of the table.
   */
  toString(): string {
    return JSON.stringify(this.records().slice(0, 10), null, 2);
  }

  /**
   * Returns a new Microtable instance containing the records matching the specified fields.
   *
   * @param {Partial<T>} match - An object specifying the fields and values to match.
   * @returns {Microtable<T>} A new Microtable instance containing the matching records.
   *
   * @example
   * ```
   * const activities = Microtable.create<Activity>([
   *   {person: 'Alice',   activity: 'hiking',   rating: 5},
   *   {person: 'Alice',   activity: 'swimming', rating: 3},
   *   {person: 'Bob',     activity: 'hiking',   rating: 2},
   *   {person: 'Bob',     activity: 'swimming', rating: 4},
   * ]);
   *
   * console.log(
   *   activities
   *     .where({person: 'Bob', activity: 'hiking'})
   *     .records()
   * );
   * // Output: [{person: 'Bob', activity: 'hiking', rating: 2}]
   * ```
   */
  where(match: Partial<T>): Microtable<T> {
    const keys = Object.keys(match);
    const key = keys.join(",");

    if (this.indexes[key]) {
      const indexKey = JSON.stringify(keys.map((k) => match[k]));
      const records = (this.indexes[key].get(indexKey) || []).map(i => this.record(i));
      return Microtable.create<T>(records, this.fields);
    } else {
      const keys = Object.keys(match);
      const key = keys.join(",");

      if (this.indexes[key]) {
        const indexKey = keys.map((k) => match[k]).join(",");
        const records = (this.indexes[key].get(indexKey) || []).map(i => this.record(i));
        return Microtable.create<T>(records, this.fields);
      } else {
        const records: T[] = [];

        const rowLength = this.data[Object.keys(this.data)[0]].length;
        for (let i = 0; i < rowLength; i++) {
          let matchFound = true;
          for (let j = 0; j < keys.length; j++) {
            if (this.data[keys[j]][i] !== match[keys[j]]) {
              matchFound = false;
              break;
            }
          }
          if (matchFound) {
            const record: Partial<T> = {};
            Object.keys(this.data).forEach((key) => {
              (record as any)[key] = this.data[key][i];
            });
            records.push(record as T);
          }
        }
        return Microtable.create(records, this.fields);
      }
    }
  }

  /**
   * Returns the first record matching the specified fields.
   */
  get(obj: WithSymbolValues<Partial<T>>) {
    let blankField: keyof T | undefined;
    const match = Object.keys(obj).reduce((acc, key: keyof T) => {
      if (obj[key] !== Microtable.blank) {
        acc[key] = obj[key] as T[keyof T];
      } else {
        if (blankField) {
          throw new Error("Only one field can be blank."); 
        } else {
          blankField = key;
        }
      }
      return acc;
    }, {} as Partial<T>);
    if (!blankField) {
      if (this.fields.length - Object.keys(match).length > 1) {
        throw new Error("Must supply a blank field or supply values for all fields except one");
      } else {
        blankField = this.fields.find((field) => !match[field]);
        if (!blankField) {
          throw new Error("No blank field found.");
        }
      }
    }
    const matchingRecords = this.where(match).records();
    if (matchingRecords.length > 1) {
      throw new Error("More than one record matches the specified fields.");
    } else {
      const [firstRecord] = matchingRecords;
      if (!firstRecord) {
        return undefined;
      } else {
        return firstRecord[blankField];
      }
    }
  }

  /**
   * 
   * Return a new Microtable instance containing the specified columns.
   * 
   * @param {string[]} columns - The names of the columns to select.
   * 
   * @example
   * ```
   * const alphabet = Microtable.create({ index: number; letter: string }>({
   *   index: [1, 2, 3],
   *   letter: ['a', 'b', 'c'],
   *   scrabble_points: [1, 3, 3],
   * });
   * 
   * console.log(alphabet.select(['index', 'letter']).records());
   */
  select<K extends keyof T>(...columns: K[]): Microtable<Pick<T, K>> {
    const records: Pick<T, K>[] = [];
    const rowLength = this.data[Object.keys(this.data)[0]].length;
    for (let i = 0; i < rowLength; i++) {
      const record: Partial<T> = {};
      columns.forEach((column) => {
        (record as any)[column] = this.data[column][i];
      });
      records.push(record as Pick<T, K>);
    }
    return Microtable.create(records);
  }

  single() {
    if (this.fields.length !== 1 || this.length !== 1) {
      throw new Error("Number of columns and rows should be 1")
    }
    return this.data[this.fields[0]][0];
  }

  /**
   * Creates an index for the specified columns.
   *
   * This method builds an index to optimize retrieval of records based on
   * the specified columns. The created index is used to speed up the `records`
   * method when querying on the indexed columns.
   *
   * @param {string[]} columns - The names of the columns to create an index for.
   * @throws {Error} If any of the specified columns do not exist in the table.
   */
  createIndex(...columns: (keyof T)[]): void {
    const key = columns.join(",");

    const index = new Map<any, any[]>();
    const rowLength = this.data[Object.keys(this.data)[0]].length;
    for (let i = 0; i < rowLength; i++) {
      const indexKey = JSON.stringify(columns.map((column) => this.data[column][i]))
      if (index.has(indexKey)) {
        index.get(indexKey)!.push(i);
      } else {
        index.set(indexKey, [i]);
      }
    }
    this.indexes[key] = index;
  }

  /**
   * Deletes the index for the specified columns.
   * @param {string[]} columns - The names of the columns to delete the index for.
   * @throws {Error} If any of the specified columns do not exist in the table.
   * @throws {Error} If no index exists for the specified columns.
   * @example
   * const alphabet = Microtable.create({ index: number; letter: string }>({
   *  index: [1, 2, 3],
   *  letter: ['a', 'b', 'c'],
   * });
   *
   * alphabet.deleteIndex(['index']);
   */
  deleteIndex(...columns: (keyof T)[]): void {
    const key = columns.join(",");
    if (this.uniquenessIndexNames.includes(key)) {
      this.uniquenessIndexNames = this.uniquenessIndexNames.filter((name) => name !== key);
    }
    delete this.indexes[key];
  }

  /**
   * Checks and subsequently enforces a uniqueness constraint on 
   * the specified columns.
   * 
   * @param columns - The names of the columns to check for uniqueness.
   */
  uniquenessConstraint(...columns: (keyof T)[]): void {
    if (!this.satisfiesUniquenessConstraint(...columns)) {
      throw new Error(`Uniqueness constraint violated for columns ${columns.join(",")}`);
    }
    const key = columns.join(",");
    this.uniquenessIndexNames.push(key);
    this.createIndex(...columns); 
  }

  /**
   * Check whether the table satisfies a uniqueness constraint
   * corresponding to the specified columns
   * 
   * @param columns - The names of the columns to check for uniqueness.
   */
  satisfiesUniquenessConstraint(...columns: (keyof T)[]): boolean {
    const tuples = this.select(...columns).records().map(rec => JSON.stringify(rec));
    return new Set(tuples).size === tuples.length;
  }

  /**
   * Inserts a new record into the table.
   * @param {T} record - The record to insert.
   */
  insert(record: Partial<T>): void {
    // check whether the record violates a uniqueness constraint:
    for (const indexName of this.uniquenessIndexNames) {
      const index = this.indexes[indexName];
      const columns = indexName.split(",");
      const indexKeyForNewRow = JSON.stringify(
        columns
          .map((column) => record[column])
      );
      if (index.has(indexKeyForNewRow)) {
        // remove those rows from the table:
        const rowsToDelete = index.get(indexKeyForNewRow)!;
        for (const rowToDelete of rowsToDelete) {
          this.length -= 1;
          for (const column of this.fields) {
            this.data[column].splice(rowToDelete, 1);
          }
        }
      }
    }

    // Update the data
    for (const key in record) {
      if (record.hasOwnProperty(key)) {
        this.data[key].push(record[key] as T[Extract<keyof T, string>]);
      }
    }
    
    this.length += 1;
    const newRowIndex = this.length - 1;

    // Update the indexes
    for (const indexKey in this.indexes) {
      const index = this.indexes[indexKey];
      const columns = indexKey.split(",");
      const indexKeyForNewRow = columns
        .map((column) => record[column])
        .join(",");
      if (index.has(indexKeyForNewRow)) {
        index.get(indexKeyForNewRow)!.push(newRowIndex);
      } else {
        index.set(indexKeyForNewRow, [newRowIndex]);
      }
    }
  }
}

const activityRatings = Microtable.create([
  {person: 'Alice',   activity: 'hiking',   rating: 5},
  {person: 'Alice',   activity: 'swimming', rating: 3},
  {person: 'Bob',     activity: 'hiking',   rating: 2},
  {person: 'Bob',     activity: 'swimming', rating: 4},
  {person: 'Bob',     activity: 'running',  rating: 5},
  {person: 'Charlie', activity: 'swimming', rating: 5},
  {person: 'Charlie', activity: 'running',  rating: 1},
]);

console.log(activityRatings.where({person: 'Bob'}).records());

activityRatings.createIndex('person');
console.log(activityRatings.where({person: 'Bob'}).records());

console.log(activityRatings.select('person', 'activity'))

console.log(
  activityRatings
    .where({person: 'Bob', activity: 'hiking'})
    .select('rating')
    .single()
);