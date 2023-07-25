# indexed-table

`indexed-table` is a lightweight in-memory DataFrame for JavaScript. At less than 3 KB minified, it's between 100 and 1000 times smaller than more full-featured DataFrame libraries like [Arquero](https://uwdata.github.io/arquero/), [https://sql.js.org/](sql.js), or [Danfo](https://danfo.jsdata.org/).

## Installation

You can install indexed-table via npm:

```bash
npm install indexed-table
```

## Basic Usage

First, import the `IndexedTable` class:

```javascript
import { IndexedTable } from "indexed-table";
```

To create a new IndexedTable, use the `IndexedTable.create` method:

```javascript
const myTable = IndexedTable.create([
    { person: "Alice", activity: "hiking", rating: 5 },
    { person: "Alice", activity: "swimming", rating: 3 },
    { person: "Bob", activity: "hiking", rating: 2 },
    { person: "Bob", activity: "swimming", rating: 4 },
    { person: "Bob", activity: "running", rating: 5 },
    { person: "Charlie", activity: "swimming", rating: 5 },
    { person: "Charlie", activity: "running", rating: 1 },
]);
```

## Querying

IndexedTable methods return new tables, allowing you to chain multiple operations together:

```javascript
const results = myTable
  .where({ person: "Bob" })
  .select("activity", "rating");
```

The `where` method filters `myTable` to only include rows where the person is Bob. The `select` method then returns a new table with only the activity and rating columns.

## Indexing and Uniqueness

IndexedTable supports the creation of indexes on any combination of fields:

```javascript
myTable.createIndex("activity", "rating");
```

After creating the index, queries that filter on the activity and rating fields will be faster.

You can also delete indexes:

```javascript
myTable.deleteIndex("activity", "rating");
```

IndexedTable supports the imposition of uniqueness constraints on any combination of fields:

```javascript
myTable.uniquenessConstraint("person", "activity");
```

Imposing a uniqueness constraint creates an index on the given columns automatically. Using the `deleteIndex` method on a combination of columns that has a uniqueness constraint removes both the index and the constraint.

## Inserting records

You can insert new records with the `insert` method:

```javascript
myTable.insert({ person: "Charlie", activity: "hiking", rating: 4 });
```

If you insert a record that would violate a uniqueness constraint, existing records are deleted as necessary to accommodate the new record:

```javascript
myTable.insert({ person: "Alice", activity: "hiking", rating: 4 });
```

## Retrieving Single Values

The `single` method can be used to retrieve a single value from the table. For example, to get Bob's rating for hiking:

```javascript
const rating = myTable
  .where({ person: "Bob", activity: "hiking" })
  .select("rating")
  .single();
```

## When to Use IndexedTable

You can think of a `IndexedTable` like a souped-up Javascript `Map`. It:

1. Supports arbirarily many columns instead of just two (keys and values).
2. Supports constant-time lookup of any column value based on any combination of other columns.

These capabilities are especially useful as an alternative to the pattern of storing the same data in multiple `Map` objects to support a variety of different lookup patterns that you need in your application. DataFrame libraries are seldom used for this purpose because they are large and their ergonomics are not well-suited to it. IndexedTable is small enough to be used in place of `Map` whenever it would be convenient.

## When not to use IndexedTable

IndexedTable is not a replacement for a relational database. It does not provide features like transactions, joins, aggregations, sorting, and many other features that relational databases provide.

Likewise, IndexedTable is not a replacement for a full-featured DataFrame library. It achieves its small size by omitting many features that are important for data analysis but not necessary for use cases that are doable but cumbersome with a `Map`.

In summary, here are the options mentioned in this README in increasing order of size and complexity:

1. `Map`, built-in - a two-column store that supports fast lookup of values based on keys.
2. `IndexedTable`, 3 KB - a multi-column store that supports fast lookup of data based on any combination of columns.
3. `DataFrame`, ~100 KB - a multi-column store that includes a wide variety of statistically useful features, typically including the ones provided by IndexedTable.
4. In-memory relational database, ~1000 KB - a multi-table store with most or all of the features of a `DataFrame` library and many additional features.
5. Persistent relational database, N/A - a multi-table store with all of the features of an in-memory relational database plus the ability to store data durably in a centralized way.


## Testing and Documentation

This library is tested with Jest. Please see the test files for detailed usage examples.

The library is documented with JSDoc. This means that you can look to the source code for detailed documentation of each available method, and you can also read docstrings in any IDE that supports JSDoc.


## License

This library is licensed under the MIT license. See the LICENSE file for more details.
