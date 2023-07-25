type TableRecord = { [key: string]: unknown };

type DataFrame<T extends TableRecord> = {
  [P in keyof T]: T[P][];
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
  
  constructor(data: DataFrame<T> | T[], fields: (keyof T)[] = []) {
    if (Array.isArray(data)) {
      const keys = fields.length
        ? fields
        : (Object.keys(data[0]) as (keyof T)[]);
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
  static create<T extends TableRecord>(
    data: DataFrame<T> | T[],
    fields: (keyof T)[] = []
  ) {
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
    return JSON.stringify(this.records(), null, 2);
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
    const matchFields = Object.keys(match);
    const key = this.fieldKey(matchFields);

    if (this.indexes[key]) {
      const indexKey = JSON.stringify(matchFields.map((k) => match[k]));
      const records = (this.indexes[key].get(indexKey) || []).map((i) =>
        this.record(i)
      );
      return Microtable.create<T>(records, this.fields);
    } else {
      const matchFields = Object.keys(match);
      const key = this.fieldKey(matchFields);

      if (this.indexes[key]) {
        const indexKey = matchFields.map((k) => match[k]).join(",");
        const rowPositions = this.indexes[key].get(indexKey) || [];
        return this.filterByRowIndex(rowPositions);
      } else {
        const rowPositions: number[] = [];

        const rowLength = this.data[Object.keys(this.data)[0]].length;
        for (let i = 0; i < rowLength; i++) {
          let matchFound = true;
          for (let j = 0; j < matchFields.length; j++) {
            if (this.data[matchFields[j]][i] !== match[matchFields[j]]) {
              matchFound = false;
              break;
            }
          }
          if (matchFound) {
            rowPositions.push(i);
          }
        }
        return this.filterByRowIndex(rowPositions);
      }
    }
  }

  /**
   *
   * Return a new Microtable instance containing the specified fields.
   *
   * @param {string[]} fields - The field names to select.
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
  select<K extends keyof T>(...fields: K[]): Microtable<Pick<T, K>> {
    const records: Pick<T, K>[] = [];
    const rowLength = this.data[Object.keys(this.data)[0]].length;
    for (let i = 0; i < rowLength; i++) {
      const record: Partial<T> = {};
      fields.forEach((field) => {
        (record as any)[field] = this.data[field][i];
      });
      records.push(record as Pick<T, K>);
    }
    return Microtable.create(records);
  }

  /**
   * Return the element contained in a one-row, one-column table.
   * Throw an error if the table does not have both one row and one column.
   *
   * @example
   * ```
   * const alphabet = Microtable.create({ index: number; letter: string }>({
   *   index: [1, 2, 3],
   *   letter: ['a', 'b', 'c'],
   * });
   *
   * console.log(alphabet.where({index: 1}).select('letter').single());
   *
   * ```
   */
  single() {
    if (this.fields.length !== 1 || this.length !== 1) {
      throw new Error("Number of columns and rows should be 1");
    }
    return this.data[this.fields[0]][0];
  }

  /**
   * Creates an index for the specified fields.
   *
   * This method builds an index to optimize retrieval of records based on
   * the specified fields. The created index is used to speed up the `records`
   * method when querying on the indexed fields.
   *
   * @param {string[]} fields - The field names to create an index for.
   * @throws {Error} If any of the specified fields do not exist in the table.
   */
  createIndex(...fields: (keyof T)[]): void {
    const key = this.fieldKey(fields);

    const index = new Map<any, any[]>();
    const rowLength = this.data[Object.keys(this.data)[0]].length;
    for (let i = 0; i < rowLength; i++) {
      const indexKey = JSON.stringify(
        fields.map((field) => this.data[field][i])
      );
      if (index.has(indexKey)) {
        index.get(indexKey)!.push(i);
      } else {
        index.set(indexKey, [i]);
      }
    }
    this.indexes[key] = index;
  }

  /**
   * Deletes the index for the specified fields.
   * @param {string[]} fields - The names of the fields to delete the index for.
   * @throws {Error} If any of the specified fields do not exist in the table.
   * @throws {Error} If no index exists for the specified fields.
   * @example
   * const alphabet = Microtable.create({ index: number; letter: string }>({
   *  index: [1, 2, 3],
   *  letter: ['a', 'b', 'c'],
   * });
   *
   * alphabet.deleteIndex(['index']);
   */
  deleteIndex(...fields: (keyof T)[]): void {
    const key = this.fieldKey(fields);
    if (this.uniquenessIndexNames.includes(key)) {
      this.uniquenessIndexNames = this.uniquenessIndexNames.filter(
        (name) => name !== key
      );
    }
    delete this.indexes[key];
  }

  /**
   * Checks and subsequently enforces a uniqueness constraint on
   * the specified fields.
   *
   * @param fields - The names of the fields to check for uniqueness.
   */
  uniquenessConstraint(...fields: (keyof T)[]): void {
    if (!this.satisfiesUniquenessConstraint(...fields)) {
      throw new Error(
        `Uniqueness constraint violated for columns ${fields.join(",")}`
      );
    }
    const key = this.fieldKey(fields);
    this.uniquenessIndexNames.push(key);
    this.createIndex(...fields);
  }

  /**
   * Check whether the table satisfies a uniqueness constraint
   * corresponding to the specified fields
   *
   * @param fields - The names of the fields to check for uniqueness.
   */
  satisfiesUniquenessConstraint(...fields: (keyof T)[]): boolean {
    const tuples = this.select(...fields)
      .records()
      .map((rec) => JSON.stringify(rec));
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
      const fields = indexName.split(",");
      const indexKeyForNewRow = JSON.stringify(
        fields.map((field) => record[field])
      );
      if (index.has(indexKeyForNewRow)) {
        // remove those rows from the table:
        const rowsToDelete = index.get(indexKeyForNewRow)!;
        for (const rowToDelete of rowsToDelete) {
          this.length -= 1;
          for (const fields of this.fields) {
            this.data[fields].splice(rowToDelete, 1);
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
      const fields = indexKey.split(",");
      const indexKeyForNewRow = JSON.stringify(fields.map((field) => record[field]));
      if (index.has(indexKeyForNewRow)) {
        index.get(indexKeyForNewRow)!.push(newRowIndex);
      } else {
        index.set(indexKeyForNewRow, [newRowIndex]);
      }
    }
  }

  /**
   * Put a list of fields in the same order that those fields appear
   * in the field attribute
   *
   * @param fields - The names of the fields to sort by.
   */
  private sortFields(fields: (keyof T)[]): (keyof T)[] {
    const sortedFields = [...fields];
    sortedFields.sort((a, b) => {
      return this.fields.indexOf(a) - this.fields.indexOf(b);
    });
    return sortedFields;
  }

  /**
   * Returns a string representation of the specified fields.
   * @param fields - The names of the fields to return a key for.
   * @returns {string} A string representation of the specified fields.
   * @throws {Error} If any of the specified fields do not exist in the table.
   */
  private fieldKey(fields: (keyof T)[]): string {
    return this.sortFields(fields).join(",");
  }

  /**
   * Returns a new table containing the specified rows.
   *
   * @param indices - The indices of the rows to include in the result table
   * @returns - A new Microtable instance containing the specified rows
   */
  private filterByRowIndex(indices: number[]) {
    const data: Partial<DataFrame<T>> = {};
    for (let field of this.fields) {
      data[field] = indices.map((i) => this.data[field][i]);
    }
    return Microtable.create<T>(data as DataFrame<T>, this.fields);
  }
}
