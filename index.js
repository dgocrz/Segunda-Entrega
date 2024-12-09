const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
const uuid = require('uuid');
const multer = require('multer');
const bcrypt = require('bcrypt');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de base de datos
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  port: process.env.DB_PORT,
  logging: false // Para evitar logs innecesarios
});

// Modelos
const Alumno = sequelize.define('Alumno', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombres: { type: DataTypes.STRING, allowNull: false },
  apellidos: { type: DataTypes.STRING, allowNull: false },
  matricula: { type: DataTypes.STRING, allowNull: false, unique: true },
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
  numeroEmpleado: { type: DataTypes.STRING, allowNull: false, unique: true },
  nombres: { type: DataTypes.STRING, allowNull: false },
  apellidos: { type: DataTypes.STRING, allowNull: false },
  horasClase: { type: DataTypes.INTEGER, allowNull: false }
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Endpoints de Alumnos
app.post('/alumnos', async (req, res) => {
  const { nombres, apellidos, matricula, promedio, password } = req.body;
  if (!nombres || !apellidos || !matricula || promedio == null || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const alumno = await Alumno.create({ nombres, apellidos, matricula, promedio, password });
    res.status(201).json(alumno);
  } catch (error) {
    console.error('Error al crear alumno:', error);
    res.status(500).json({ error: 'Error al crear el alumno' });
  }
});

app.get('/alumnos', async (req, res) => {
  try {
    const alumnos = await Alumno.findAll();
    res.status(200).json(alumnos);
  } catch (error) {
    console.error('Error al obtener alumnos:', error);
    res.status(500).json({ error: 'Error al obtener los alumnos' });
  }
});

app.get('/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    res.status(200).json(alumno);
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    res.status(500).json({ error: 'Error al obtener el alumno' });
  }
});

app.delete('/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    await alumno.destroy();
    res.status(200).send();
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({ error: 'Error al eliminar el alumno' });
  }
});

// Endpoints de Profesores
app.post('/profesores', async (req, res) => {
  const { numeroEmpleado, nombres, apellidos, horasClase } = req.body;
  if (!numeroEmpleado || !nombres || !apellidos || horasClase == null) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const profesor = await Profesor.create({ numeroEmpleado, nombres, apellidos, horasClase });
    res.status(201).json(profesor);
  } catch (error) {
    console.error('Error al crear profesor:', error);
    res.status(500).json({ error: 'Error al crear el profesor' });
  }
});

app.get('/profesores/:id', async (req, res) => {
  try {
    const profesor = await Profesor.findByPk(req.params.id);
    if (!profesor) {
      return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    res.status(200).json(profesor);
  } catch (error) {
    console.error('Error al obtener profesor:', error);
    res.status(500).json({ error: 'Error al obtener el profesor' });
  }
});

app.delete('/profesores/:id', async (req, res) => {
  try {
    const profesor = await Profesor.findByPk(req.params.id);
    if (!profesor) {
      return res.status(404).json({ error: 'Profesor no encontrado' });
    }

    await profesor.destroy();
    res.status(200).send();
  } catch (error) {
    console.error('Error al eliminar profesor:', error);
    res.status(500).json({ error: 'Error al eliminar el profesor' });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Sincronización de base de datos e inicio del servidor
sequelize.sync()
  .then(() => {
    app.listen(3000, () => {
      console.log('Servidor en ejecución en el puerto 3000');
    });
  })
  .catch(error => {
    console.error('Error al sincronizar la base de datos:', error);
  });
