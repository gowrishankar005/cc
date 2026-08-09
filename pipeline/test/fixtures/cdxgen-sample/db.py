import psycopg2


class OrdersDb:
    def __init__(self):
        self.conn = psycopg2.connect("dbname=orders")

    def find_all(self):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM orders")
            return cur.fetchall()
