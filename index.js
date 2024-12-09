const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
const uuid = require('uuid');
const multer = require('multer');
const bcrypt = require('bcrypt');

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const sns = new AWS.SNS();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuración de base de datos
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  port: process.env.DB_PORT
});

// Definición de modelos
const Alumno = sequelize.define('Alumno', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombres: { type: DataTypes.STRING, allowNull: false },
  apellidos: { type: DataTypes.STRING, allowNull: false },
  matricula: { type: DataTypes.STRING, allowNull: false },
  promedio: { type: DataTypes.FLOAT, allowNull: false },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      const salt = bcrypt.genSaltSync(10);
      this.setDataValue('password', bcrypt.hashSync(value, salt));
    }
  },
  fotoPerfilUrl: { type: DataTypes.STRING, allowNull: true }
});

const Profesor = sequelize.define('Profesor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numeroEmpleado: { type: DataTypes.STRING, allowNull: false },
  nombres: { type: DataTypes.STRING, allowNull: false },
  apellidos: { type: DataTypes.STRING, allowNull: false },
  horasClase: { type: DataTypes.INTEGER, allowNull: false }
});

// Configuración de Multer para subida de archivos
const upload = multer({ storage: multer.memoryStorage() });

// Funciones de validación
function validarAlumno(data) {
  const requiredFields = ['nombres', 'apellidos', 'matricula', 'promedio', 'password'];
  for (const field of requiredFields) {
    if (!data[field]) return { isValid: false, message: `El campo ${field} es obligatorio.` };
  }
  if (typeof data.promedio !== 'number') return { isValid: false, message: 'El promedio debe ser un número.' };
  return { isValid: true };
}

function validarProfesor(data) {
  const requiredFields = ['numeroEmpleado', 'nombres', 'apellidos', 'horasClase'];
  for (const field of requiredFields) {
    if (!data[field]) return { isValid: false, message: `El campo ${field} es obligatorio.` };
  }
  if (typeof data.horasClase !== 'number' || !Number.isInteger(data.horasClase)) {
    return { isValid: false, message: 'Las horas de clase deben ser un número entero.' };
  }
  return { isValid: true };
}

// Endpoints para Alumnos
app.get('/alumnos', async (req, res) => {
  try {
    const alumnos = await Alumno.findAll();
    res.status(200).json(alumnos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alumnos', async (req, res) => {
  const { isValid, message } = validarAlumno(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const alumno = await Alumno.create(req.body);
    res.status(201).json(alumno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/alumnos/:id', async (req, res) => {
  const { isValid, message } = validarAlumno(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });

    await alumno.update(req.body);
    res.status(200).json(alumno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir foto de perfil
app.post('/alumnos/:id/fotoPerfil', upload.single('foto'), async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `alumnos/${uuid.v4()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    const uploadResult = await s3.upload(params).promise();
    alumno.fotoPerfilUrl = uploadResult.Location;
    await alumno.save();

    res.status(200).json({ fotoPerfilUrl: uploadResult.Location });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestión de sesiones
app.post('/alumnos/:id/session/login', async (req, res) => {
  try {
    const { password } = req.body;
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno || !bcrypt.compareSync(password, alumno.password)) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    const sessionString = uuid.v4();
    await dynamoDB.put({
      TableName: process.env.SESSIONS_TABLE,
      Item: { alumnoId: req.params.id, sessionString, active: true }
    }).promise();

    res.status(200).json({ sessionString });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alumnos/:id/session/logout', async (req, res) => {
  try {
    await dynamoDB.update({
      TableName: process.env.SESSIONS_TABLE,
      Key: { alumnoId: req.params.id },
      UpdateExpression: 'SET active = :inactive',
      ExpressionAttributeValues: { ':inactive': false }
    }).promise();

    res.status(200).json({ message: 'Sesión cerrada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Servidor corriendo en el puerto 3000.'));
