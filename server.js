const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 4000;
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017';
const dbName = 'Vehicle';
const collectionName = 'Cars';
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

// Middleware 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/image/')));
app.use(express.json());

//ham ket noi db 
async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB server successfully");
    } catch (error) {
        console.error("❌ DB Connection Error:", error);
        process.exit(1);
    }
}

// list danh sach len browser
app.get('/list', async (req, res) => {
    try {
        connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const Cars = await collection.find({}).toArray();
        res.json(Cars);
    } catch (error) {
        console.error("❌ DB Connection Error:", error);
        process.exit(1);
    }
});

// ham phân loại xe theo ID
app.get('/sortNames', async (req, res) => {
    try {
        connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const Cars = await collection.find({}).toArray();
        // Phân loại xe theo ID
        const classifiedCars = {
            MBN: Cars.filter(car => car.ID.startsWith('MBN')),
            MBA: Cars.filter(car => car.ID.startsWith('MBA')),
            MBM: Cars.filter(car => car.ID.startsWith('MBM'))
        };

        res.json(classifiedCars);
    } catch (error) {
        console.error("❌ DB Connection Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/sortCars', async (req, res) => {
    const order = req.query.order === 'desc' ? -1 : 1; // Sắp xếp giảm dần (-1) hoặc tăng dần (1)

    try {
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Lấy danh sách xe và sắp xếp theo giá
        const cars = await collection.find().sort({ GiaBan: order }).toArray();
        res.json(cars);
    } catch (error) {
        console.error("❌ Error in /sortCars:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/searchCars', async (req, res) => {
    const fuel = req.query.fuel;
    const seats = req.query.seats;
    const year = parseInt(req.query.year) || 0;
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || Infinity;
    const keyword = req.query.keyword ? req.query.keyword.trim().toLowerCase() : '';
    console.log('Search Params:', { fuel, seats, year, minPrice, maxPrice, keyword});

    try {
        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Tạo bộ lọc MongoDB
        const query = {
            GiaBan: { $gte: minPrice, $lte: maxPrice } // Lọc theo khoảng giá
        };

        // Lọc theo nhiên liệu
        if (fuel) {
            query.NhienLieu = { $regex: fuel, $options: 'i' };
        }

        // Lọc theo số chỗ ngồi
        if (seats) {
            query.SoChoNgoi = parseInt(seats.split('-')[0]);
        }

        // Lọc theo năm sản xuất
        if (year !==0) {
            query.NamSX = parseInt(year);
        }

        // Lọc theo từ khóa
        if (keyword) {
            const keywordFilter = [
                { Ten: { $regex: keyword, $options: 'i' } },
                { NhienLieu: { $regex: keyword, $options: 'i' } },
                { DongCo: { $regex: keyword, $options: 'i' } }
            ];
            query.$or = keywordFilter;
        }

        console.log('MongoDB Query:', query);

        // Lấy dữ liệu từ MongoDB với bộ lọc
        const cars = await collection.find(query).toArray();
        res.json(cars);
    } catch (error) {
        console.error("❌ Error in /searchCars:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// trang home
app.get('/', (req, res) => {
    res.sendFile(path.join (__dirname , '/public/page/Home.html'));
  });
  
  // trang danh sach
  app.get('/CarList', (req, res) => {
      res.sendFile(path.join (__dirname , '/public/page/CarList.html'));
    });
  
  // trang cardetail
  app.get('/CarDetail.html', (req, res) => {
      res.sendFile(path.join (__dirname , '/public/page/CarDetail.html'));
  });
  
  // trang add
  app.get('/Add', (req, res) => {
      res.sendFile(path.join (__dirname , '/public/page/Add.html'));
  });

  app.get('/NewID', async (req, res) => {
    try {
        const { loaiXe, namSX } = req.query;
        const yearSuffix = namSX.slice(-2); // Lấy 2 số cuối của năm sản xuất

        // Quy ước 3 ký tự đầu của ID theo loại xe
        let prefix = '';
        if (loaiXe === 'Mercedes-Benz') {
            prefix = 'MBN';
        } else if (loaiXe === 'Mercedes-AMG') {
            prefix = 'MBA';
        } else if (loaiXe === 'Mercedes-Maybach') {
            prefix = 'MBM';
        }

        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Tìm các xe có ID bắt đầu với prefix
        const cars = await collection.find({ ID: { $regex: `^${prefix}${yearSuffix}` } }).toArray();

        // Lấy số thứ tự lớn nhất từ 4 ký tự cuối của ID
        const maxNumber = cars.reduce((max, car) => {
            const idSuffix = parseInt(car.ID.slice(-4)); // Lấy 4 ký tự cuối
            return idSuffix > max ? idSuffix : max;
        }, 0);

        // Tạo ID mới
        const nextNumber = (maxNumber + 1).toString().padStart(4, '0'); // Đảm bảo 4 chữ số
        const generatedID = `${prefix}${yearSuffix}${nextNumber}`;

        res.json({ id: generatedID });
    } catch (error) {
        console.error("❌ Error in /NewID:", error);
        res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
  });

  app.post('/Add', async (req, res) => {
    try {
        console.log('Dữ liệu nhận từ client:', req.body);

        const { ID, Ten, HinhAnh, GiaBan, NamSX, NhienLieu, DongCo, SoChoNgoi, DanhGiaChuyenMon, UuDiem, NhuocDiem } = req.body;

        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Thêm sản phẩm vào cơ sở dữ liệu
        const newCar = {
            ID,
            Ten,
            HinhAnh,
            GiaBan,
            NamSX,
            NhienLieu,
            DongCo,
            SoChoNgoi,
            DanhGiaChuyenMon,
            UuDiem,
            NhuocDiem,
        };

        await collection.insertOne(newCar);
        res.status(200).json({ message: 'Thêm sản phẩm thành công!' });
    } catch (error) {
        console.error("❌ Error in /Add:", error);
        res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
});

app.post('/importData', async (req, res) => {
    try {
        const { data } = req.body;

        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ. Phải là một mảng các đối tượng.' });
        }

        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Import dữ liệu vào MongoDB
        const result = await collection.insertMany(data);
        res.status(200).json({ message: 'Import dữ liệu thành công!', insertedCount: result.insertedCount });
    } catch (error) {
        console.error("❌ Error in /importData:", error);
        res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
});
  
  // trang update
  app.get('/Update', (req, res) => {
      res.sendFile(path.join (__dirname , '/public/page/Update.html'));
  });
  
  app.get('/getCarById', async (req, res) => {
    const carId = req.query.id; // Lấy ID xe từ query string
    try {
        await connectDB(); // Kết nối đến MongoDB
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Tìm xe theo ID
        const car = await collection.findOne({ ID: carId });
        if (!car) {
            return res.status(404).json({ error: 'Không tìm thấy xe.' });
        }
        res.json(car); // Trả về thông tin xe
    } catch (error) {
        console.error('Lỗi khi lấy thông tin xe:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/EditDetail.html', (req, res) => {
    res.sendFile(path.join (__dirname , '/public/page/EditDetail.html'));
});

app.put('/updateCar', async (req, res) => {
    const updatedCar = req.body; // Lấy dữ liệu từ yêu cầu
    try {
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Cập nhật xe theo ID
        const result = await collection.updateOne(
            { ID: updatedCar.ID }, // Tìm xe theo ID
            { $set: updatedCar } // Cập nhật thông tin xe
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy xe để cập nhật.' });
        }

        res.json({ message: 'Cập nhật thành công!' });
    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin xe:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/SearchTo', async (req, res) => {
    const keyword = req.query.keyword || '';
    console.log('Từ khóa tìm kiếm:', keyword);

    try {
        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Tạo bộ lọc tìm kiếm
        const query = {
            $or: [
                { Ten: { $regex: keyword, $options: 'i' } },
                { NhienLieu: { $regex: keyword, $options: 'i' } },
                { DongCo: { $regex: keyword, $options: 'i' } }
            ]
        };

        // Lấy dữ liệu từ MongoDB
        const cars = await collection.find(query).toArray();
        console.log('Kết quả tìm kiếm:', cars);
        res.json(cars);
    } catch (error) {
        console.error('❌ Lỗi trong /SearchToUpdate:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

  // trang xoa
  app.get('/Delete', (req, res) => {
    res.sendFile(path.join (__dirname , '/public/page/Delete.html'));
});

app.delete('/deleteCar', async (req, res) => {
    const carId = req.query.id; // Lấy ID xe từ query string
    try {
        // Kết nối đến MongoDB
        await connectDB();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Xóa xe theo ID
        const result = await collection.deleteOne({ ID: carId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy xe để xóa.' });
        }

        res.json({ message: 'Xóa sản phẩm thành công!' });
    } catch (error) {
        console.error('❌ Lỗi khi xóa sản phẩm:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
app.use(express.json());