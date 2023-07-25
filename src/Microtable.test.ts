import { Microtable } from "./Microtable";

type Activity = { person: string; activity: string; rating: number };

function randomName() {
  return Math.random().toString(36).substring(2, 15);
}

function randomActivity() {
  const activities = ["hiking", "swimming", "running"];
  return activities[Math.floor(Math.random() * activities.length)];
}

function randomRecord() {
  return {
    person: randomName(),
    activity: randomActivity(),
    rating: Math.floor(Math.random() * 5) + 1,
  };
}

function randomRecords(count: number) {
  const records: Activity[] = [];
  for (let i = 0; i < count; i++) {
    records.push(randomRecord());
  }
  return records;
}

describe("Microtable", () => {
  let activityRatings: Microtable<Activity>;
  let bigActivityRatings: Microtable<Activity>;

  beforeEach(() => {
    activityRatings = Microtable.create<Activity>([
      { person: "Alice", activity: "hiking", rating: 5 },
      { person: "Alice", activity: "swimming", rating: 3 },
      { person: "Bob", activity: "hiking", rating: 2 },
      { person: "Bob", activity: "swimming", rating: 4 },
      { person: "Bob", activity: "running", rating: 5 },
      { person: "Charlie", activity: "swimming", rating: 5 },
      { person: "Charlie", activity: "running", rating: 1 },
    ]);
    bigActivityRatings = Microtable.create(randomRecords(10 ** 4));
  });

  test("records returns all records", () => {
    const records = activityRatings.records();
    expect(records.length).toEqual(7);
  });

  test("where returns a new Microtable with matched records", () => {
    const table = activityRatings.where({ person: "Alice" });
    const records = table.records();
    expect(records.length).toEqual(2);
  });

  test("where handles out-of-order field names", () => {
    const table = activityRatings.where({ activity: "hiking", person: "Alice" });
    const records = table.records();
    expect(records.length).toEqual(1);
  });

  test("select returns a new Microtable with only the specified fields", () => {
    const table = activityRatings.select("person", "activity");
    const records = table.records();
    expect(records.length).toEqual(7);
    expect(records[0]).toEqual({ person: "Alice", activity: "hiking" });
  });

  test("createIndex creates an index", () => {
    // Since we don't have direct access to the internal indexes,
    // we can just test that querying on the indexed field is faster.
    // This isn't an ideal test, but it's the best we can do without
    // modifying the Microtable class.
    bigActivityRatings.insert({
      person: "Alice",
      activity: "skiing",
      rating: 5,
    });
    const start = performance.now();
    const resultWithoutIndex = bigActivityRatings.where({
      activity: "skiing",
      rating: 5,
    });
    const end = performance.now();
    const lengthWithoutIndex = resultWithoutIndex.length;
    const timeWithoutIndex = end - start;

    bigActivityRatings.createIndex("activity", "rating");
    const startWithIndex = performance.now();
    const resultWithIndex = bigActivityRatings.where({
      activity: "skiing",
      rating: 5,
    });
    const endWithIndex = performance.now();
    const lengthWithIndex = resultWithIndex.length;
    const timeWithIndex = endWithIndex - startWithIndex;

    expect(timeWithIndex).toBeLessThan(timeWithoutIndex);
    expect(lengthWithoutIndex).toEqual(lengthWithIndex);
  });

  test("deleteIndex deletes an index", () => {
    bigActivityRatings.insert({
      person: "Alice",
      activity: "skiing",
      rating: 5,
    });
    bigActivityRatings.createIndex("activity", "rating");
    bigActivityRatings.deleteIndex("activity", "rating");
    // Similar to the createIndex test, we don't have a good way of
    // testing this without access to the internal indexes, so we'll
    // just test that querying is slower without the index.
    const start = performance.now();
    const resultWithoutIndex = bigActivityRatings.where({
      activity: "skiing",
      rating: 5,
    });
    const end = performance.now();
    const lengthWithoutIndex = resultWithoutIndex.length;
    const timeWithoutIndex = end - start;

    bigActivityRatings.createIndex("activity", "rating");
    const startWithIndex = performance.now();
    const resultWithIndex = bigActivityRatings.where({
      activity: "skiing",
      rating: 5,
    });
    const endWithIndex = performance.now();
    const lengthWithIndex = resultWithIndex.length;
    const timeWithIndex = endWithIndex - startWithIndex;

    expect(timeWithoutIndex).toBeGreaterThan(timeWithIndex);
    expect(lengthWithoutIndex).toEqual(lengthWithIndex);
  });

  test("insert adds a new record", () => {
    activityRatings.insert({
      person: "Charlie",
      activity: "hiking",
      rating: 4,
    });
    const records = activityRatings.where({
      person: "Charlie",
      activity: "hiking",
    });
    expect(records.length).toEqual(1);
  });

  test("uniqueness constraint throws if not unique", () => {
    expect(() => {
      activityRatings.insert({
        person: "Alice",
        activity: "hiking",
        rating: 4,
      });
      activityRatings.uniquenessConstraint("person", "activity");
    }).toThrow();
  });

  test("uniqueness constraint imposed on insert", () => {
    activityRatings.uniquenessConstraint("person", "activity");
    activityRatings.insert({ person: "Alice", activity: "hiking", rating: 4 });
    expect(activityRatings.length).toEqual(7);
  });

  test("single method retrieves correct value", () => {
    const result = activityRatings
      .where({ person: 'Bob', activity: 'hiking' })
      .select('rating')
      .single();
    expect(result).toEqual(2);
  });
});
